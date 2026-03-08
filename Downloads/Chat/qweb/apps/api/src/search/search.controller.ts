import { Controller, Get, Post, Body, Query, UseGuards, HttpCode } from '@nestjs/common';
import { AccessTokenGuard } from '@/common/guards/access-token.guard';
import { CurrentUser, RequestUser } from '@/common/decorators/current-user.decorator';
import { CircuitBreaker } from '@/common/utils/circuit-breaker';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:8000';
const INTERNAL_API_KEY = process.env.PYTHON_INTERNAL_API_KEY ?? 'change-me-internal-api-key';
const breaker = new CircuitBreaker('python-search', { failThreshold: 5, resetTimeoutMs: 30_000 });

@Controller('search')
@UseGuards(AccessTokenGuard)
export class SearchController {
  @Post()
  @HttpCode(200)
  async search(
    @CurrentUser() user: RequestUser,
    @Body() body: { query: string; roomId?: string; limit?: number; offset?: number },
  ) {
    try {
      return await breaker.call(async () => {
        const res = await fetch(`${PYTHON_SERVICE_URL}/v1/search/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Api-Key': INTERNAL_API_KEY,
          },
          body: JSON.stringify({
            query: body.query,
            room_id: body.roomId,
            sender_id: undefined,
            limit: body.limit ?? 20,
            offset: body.offset ?? 0,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          throw new Error(`Search service returned ${res.status}`);
        }

        return res.json();
      });
    } catch {
      return { results: [], total: 0, query: body.query, took_ms: 0 };
    }
  }

  @Get('stats')
  async stats() {
    try {
      return await breaker.call(async () => {
        const res = await fetch(`${PYTHON_SERVICE_URL}/v1/search/stats`, {
          headers: { 'X-Internal-Api-Key': INTERNAL_API_KEY },
          signal: AbortSignal.timeout(5_000),
        });

        if (!res.ok) {
          throw new Error(`Search stats returned ${res.status}`);
        }

        return res.json();
      });
    } catch {
      return { total_messages: 0, total_terms: 0, rooms_indexed: 0, last_indexed_at: null };
    }
  }
}
