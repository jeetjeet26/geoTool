import type { AnswerBlock } from '../answer-block.js';

export type Surface = 'openai' | 'claude';

export interface ConnectorContext {
  queryId: string;
  queryText: string;
  brandName: string;
  brandDomains: string[];
  competitors: string[];
}

export interface ConnectorResult {
  answer: AnswerBlock;
  raw: unknown;
  warnings?: string[];
}

export interface Connector {
  surface: Surface;
  invoke(context: ConnectorContext): Promise<ConnectorResult>;
}
