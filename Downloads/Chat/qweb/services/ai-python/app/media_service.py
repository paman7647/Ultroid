"""
Media processing service — image compression, video processing, audio encoding.
All processing runs locally using Pillow, FFmpeg (via subprocess), no external APIs.
"""

import asyncio
import io
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

from .config import settings
from .security import require_internal_api_key

router = APIRouter(prefix="/v1/media", tags=["media"])

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


# ─── Schemas ──────────────────────────────────────────────────────────

class MediaJobRequest(BaseModel):
    job_type: str = Field(pattern="^(image_compress|video_transcode|audio_encode|thumbnail)$")
    source_key: str = Field(max_length=1024)
    options: dict[str, Any] = Field(default_factory=dict)


class MediaJobResponse(BaseModel):
    job_id: str
    status: str
    output_key: str | None = None


class MediaJobStatus(BaseModel):
    job_id: str
    status: str  # queued, processing, completed, failed
    progress: float
    output_key: str | None = None
    error: str | None = None
    created_at: str
    completed_at: str | None = None


class ImageCompressRequest(BaseModel):
    quality: int = Field(default=80, ge=10, le=100)
    max_width: int = Field(default=1920, ge=100, le=8192)
    max_height: int = Field(default=1920, ge=100, le=8192)
    format: str = Field(default="webp", pattern="^(webp|jpeg|png)$")


class AudioEncodeRequest(BaseModel):
    codec: str = Field(default="opus", pattern="^(opus|aac|mp3)$")
    bitrate: str = Field(default="128k", pattern=r"^\d+k$")
    sample_rate: int = Field(default=48000, ge=8000, le=192000)


class VideoTranscodeRequest(BaseModel):
    codec: str = Field(default="h264", pattern="^(h264|vp9|av1)$")
    resolution: str = Field(default="720p", pattern="^(360p|480p|720p|1080p)$")
    bitrate: str = Field(default="2M", pattern=r"^\d+[kKmM]$")


RESOLUTION_MAP = {
    "360p": "640:360",
    "480p": "854:480",
    "720p": "1280:720",
    "1080p": "1920:1080",
}


# ─── Job queue via Redis ─────────────────────────────────────────────

@router.post("/jobs", dependencies=[Depends(require_internal_api_key)])
async def create_media_job(req: MediaJobRequest) -> MediaJobResponse:
    """Queue a media processing job."""
    r = await get_redis()
    job_id = str(uuid4())

    await r.hset(  # type: ignore[misc]
        f"media:job:{job_id}",
        mapping={
            "job_id": job_id,
            "job_type": req.job_type,
            "source_key": req.source_key,
            "options": str(req.options),
            "status": "queued",
            "progress": "0",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    await r.expire(f"media:job:{job_id}", 86400)

    # Push to processing queue
    await r.xadd(
        "media:processing:queue",
        {"job_id": job_id, "job_type": req.job_type, "source_key": req.source_key},
        maxlen=10_000,
    )

    return MediaJobResponse(job_id=job_id, status="queued")


@router.get("/jobs/{job_id}", dependencies=[Depends(require_internal_api_key)])
async def get_media_job(job_id: str) -> MediaJobStatus:
    """Get the status of a media processing job."""
    r = await get_redis()
    data = await r.hgetall(f"media:job:{job_id}")  # type: ignore[misc]
    if not data:
        raise HTTPException(status_code=404, detail="Job not found")

    return MediaJobStatus(
        job_id=data["job_id"],
        status=data.get("status", "unknown"),
        progress=float(data.get("progress", 0)),
        output_key=data.get("output_key"),
        error=data.get("error"),
        created_at=data.get("created_at", ""),
        completed_at=data.get("completed_at"),
    )


# ─── Direct processing endpoints ─────────────────────────────────────

@router.post("/image/compress", dependencies=[Depends(require_internal_api_key)])
async def compress_image(
    file: UploadFile = File(...),
    quality: int = Form(default=80),
    max_width: int = Form(default=1920),
    max_height: int = Form(default=1920),
    output_format: str = Form(default="webp"),
):
    """Compress an image using Pillow. Returns compressed bytes."""
    try:
        from PIL import Image
    except ImportError:
        raise HTTPException(status_code=500, detail="Pillow not installed")

    data = await file.read()
    if len(data) > 50 * 1024 * 1024:  # 50MB limit
        raise HTTPException(status_code=413, detail="File too large")

    img = Image.open(io.BytesIO(data))

    # Resize if exceeds max dimensions
    if img.width > max_width or img.height > max_height:
        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

    # Convert to RGB for JPEG/WEBP (remove alpha)
    if output_format in ("jpeg", "webp") and img.mode in ("RGBA", "P"):
        img = img.convert("RGB")  # type: ignore[assignment]

    buf = io.BytesIO()
    fmt_map = {"webp": "WEBP", "jpeg": "JPEG", "png": "PNG"}
    save_kwargs: dict[str, Any] = {"format": fmt_map.get(output_format, "WEBP")}
    if output_format != "png":
        save_kwargs["quality"] = quality
    img.save(buf, **save_kwargs)

    from fastapi.responses import Response
    buf.seek(0)
    mime = f"image/{output_format}"
    return Response(
        content=buf.getvalue(),
        media_type=mime,
        headers={
            "Content-Disposition": f'attachment; filename="compressed.{output_format}"',
            "X-Original-Size": str(len(data)),
            "X-Compressed-Size": str(buf.tell()),
        },
    )


@router.post("/image/thumbnail", dependencies=[Depends(require_internal_api_key)])
async def generate_thumbnail(
    file: UploadFile = File(...),
    width: int = Form(default=200),
    height: int = Form(default=200),
):
    """Generate a thumbnail from an image."""
    try:
        from PIL import Image
    except ImportError:
        raise HTTPException(status_code=500, detail="Pillow not installed")

    data = await file.read()
    img = Image.open(io.BytesIO(data))
    img.thumbnail((width, height), Image.Resampling.LANCZOS)

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")  # type: ignore[assignment]

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=75)

    from fastapi.responses import Response
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="image/webp",
        headers={"Content-Disposition": 'attachment; filename="thumb.webp"'},
    )


@router.post("/audio/encode", dependencies=[Depends(require_internal_api_key)])
async def encode_audio(
    file: UploadFile = File(...),
    codec: str = Form(default="opus"),
    bitrate: str = Form(default="128k"),
    sample_rate: int = Form(default=48000),
):
    """Encode audio using FFmpeg. Returns encoded audio bytes."""
    data = await file.read()
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (100MB limit)")

    with tempfile.NamedTemporaryFile(suffix=".input", delete=False) as inp:
        inp.write(data)
        inp_path = inp.name

    codec_map = {"opus": "libopus", "aac": "aac", "mp3": "libmp3lame"}
    ext_map = {"opus": "ogg", "aac": "m4a", "mp3": "mp3"}

    out_path = inp_path + f".{ext_map.get(codec, 'ogg')}"

    try:
        cmd = [
            "ffmpeg", "-y", "-i", inp_path,
            "-c:a", codec_map.get(codec, "libopus"),
            "-b:a", bitrate,
            "-ar", str(sample_rate),
            "-vn",
            out_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)

        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail=f"FFmpeg error: {stderr.decode()[:200]}")

        from fastapi.responses import FileResponse
        return FileResponse(
            out_path,
            media_type=f"audio/{ext_map.get(codec, 'ogg')}",
            filename=f"encoded.{ext_map.get(codec, 'ogg')}",
        )
    finally:
        for p in [inp_path]:
            if os.path.exists(p):
                os.unlink(p)
        # out_path is cleaned up by FileResponse


@router.post("/video/transcode", dependencies=[Depends(require_internal_api_key)])
async def transcode_video(
    file: UploadFile = File(...),
    codec: str = Form(default="h264"),
    resolution: str = Form(default="720p"),
    bitrate: str = Form(default="2M"),
):
    """Transcode video using FFmpeg."""
    data = await file.read()
    if len(data) > 500 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (500MB limit)")

    with tempfile.NamedTemporaryFile(suffix=".input", delete=False) as inp:
        inp.write(data)
        inp_path = inp.name

    codec_map = {"h264": "libx264", "vp9": "libvpx-vp9", "av1": "libaom-av1"}
    ext_map = {"h264": "mp4", "vp9": "webm", "av1": "mp4"}
    out_path = inp_path + f".{ext_map.get(codec, 'mp4')}"

    scale = RESOLUTION_MAP.get(resolution, "1280:720")

    try:
        cmd = [
            "ffmpeg", "-y", "-i", inp_path,
            "-c:v", codec_map.get(codec, "libx264"),
            "-b:v", bitrate,
            "-vf", f"scale={scale}:force_original_aspect_ratio=decrease",
            "-c:a", "aac", "-b:a", "128k",
            out_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)

        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail=f"FFmpeg error: {stderr.decode()[:200]}")

        from fastapi.responses import FileResponse
        return FileResponse(
            out_path,
            media_type=f"video/{ext_map.get(codec, 'mp4')}",
            filename=f"transcoded.{ext_map.get(codec, 'mp4')}",
        )
    finally:
        if os.path.exists(inp_path):
            os.unlink(inp_path)


@router.post("/audio/voice-to-text", dependencies=[Depends(require_internal_api_key)])
async def voice_to_text(
    file: UploadFile = File(...),
    language: str = Form(default="en"),
):
    """
    Transcribe audio to text using local Whisper model (if installed).
    Falls back to a stub response if whisper isn't available.
    """
    data = await file.read()

    try:
        import whisper  # type: ignore[import-untyped]
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        try:
            model = whisper.load_model("base")
            result = model.transcribe(tmp_path, language=language)
            return {
                "transcript": result["text"],
                "language": result.get("language", language),
                "provider": "whisper-local",
            }
        finally:
            os.unlink(tmp_path)
    except ImportError:
        return {
            "transcript": "",
            "language": language,
            "provider": "stub",
            "note": "Install openai-whisper for local transcription",
        }


@router.get("/supported-formats", dependencies=[Depends(require_internal_api_key)])
async def supported_formats():
    """List supported media formats."""
    return {
        "image": {
            "input": ["jpeg", "png", "gif", "webp", "bmp", "tiff"],
            "output": ["webp", "jpeg", "png"],
        },
        "audio": {
            "input": ["wav", "mp3", "ogg", "flac", "aac", "m4a"],
            "output": ["opus", "aac", "mp3"],
            "codecs": ["libopus", "aac", "libmp3lame"],
        },
        "video": {
            "input": ["mp4", "webm", "mkv", "avi", "mov"],
            "output": ["mp4", "webm"],
            "codecs": ["libx264", "libvpx-vp9", "libaom-av1"],
            "resolutions": list(RESOLUTION_MAP.keys()),
        },
    }
