import assert from 'node:assert/strict';
import test from 'node:test';
import { NextFunction, Request, Response } from 'express';
import { listInstrumentsHandler } from '../../controllers/instruments.controller';
import { AppError } from '../../middleware/errorHandler';

const instrumentsModule = require('../../services/instruments.service') as typeof import('../../services/instruments.service');

function createMockResponse(): Response & { statusCode?: number; body?: unknown } {
  return {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as Response & { statusCode?: number; body?: unknown };
}

test('listInstrumentsHandler forwards AppError when q is empty', async () => {
  const req = { query: { q: '   ' } } as unknown as Request;
  const res = createMockResponse();
  let nextError: unknown;
  const next: NextFunction = (error?: unknown) => {
    nextError = error;
  };

  await listInstrumentsHandler(req, res, next);

  assert.ok(nextError instanceof AppError);
  assert.equal((nextError as AppError).statusCode, 400);
  assert.equal((nextError as AppError).message, 'Query parameter q is required');
});

test('listInstrumentsHandler trims q, calls service, and returns json', async () => {
  const originalListInstruments = instrumentsModule.instrumentsService.listInstruments;
  const instruments = [{ id: 1, ticker: 'AAPL', name: 'Apple', type: 'ACCION', price: 10, dailyReturnPct: 1 }];
  let receivedQuery: string | undefined;

  instrumentsModule.instrumentsService.listInstruments = async (query: string) => {
    receivedQuery = query;
    return instruments;
  };

  try {
    const req = { query: { q: '  AAPL  ' } } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = (error?: unknown) => {
      nextCalled = Boolean(error);
    };

    await listInstrumentsHandler(req, res, next);

    assert.equal(receivedQuery, 'AAPL');
    assert.equal(nextCalled, false);
    assert.deepEqual(res.body, instruments);
  } finally {
    instrumentsModule.instrumentsService.listInstruments = originalListInstruments;
  }
});

test('listInstrumentsHandler forwards service errors', async () => {
  const originalListInstruments = instrumentsModule.instrumentsService.listInstruments;
  const expectedError = new Error('service failed');
  instrumentsModule.instrumentsService.listInstruments = async () => {
    throw expectedError;
  };

  try {
    const req = { query: { q: 'AAPL' } } as unknown as Request;
    const res = createMockResponse();
    let nextError: unknown;
    const next: NextFunction = (error?: unknown) => {
      nextError = error;
    };

    await listInstrumentsHandler(req, res, next);

    assert.equal(nextError, expectedError);
  } finally {
    instrumentsModule.instrumentsService.listInstruments = originalListInstruments;
  }
});