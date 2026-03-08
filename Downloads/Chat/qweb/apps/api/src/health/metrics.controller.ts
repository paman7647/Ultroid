import { Controller, Get, Header } from '@nestjs/common';

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  metrics() {
    return [
      '# HELP qweb_api_up API process availability',
      '# TYPE qweb_api_up gauge',
      'qweb_api_up 1',
      '# HELP qweb_api_timestamp_seconds Unix timestamp',
      '# TYPE qweb_api_timestamp_seconds gauge',
      `qweb_api_timestamp_seconds ${Math.floor(Date.now() / 1000)}`,
      '',
    ].join('\n');
  }
}
