import assert from 'node:assert/strict';
import test from 'node:test';
import { NextFunction, Request, Response } from 'express';
import { getPortfolioSummaryHandler } from '../../controllers/portfolio.controller';
import { AppError } from '../../middleware/errorHandler';

const portfolioModule = require('../../services/portfolio.service') as typeof import('../../services/portfolio.service');

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

test('getPortfolioSummaryHandler forwards AppError for invalid userId', async () => {
  const req = { params: { userId: 'abc' } } as unknown as Request;
  const res = createMockResponse();
  let nextError: unknown;
  const next: NextFunction = (error?: unknown) => {
    nextError = error;
  };

  await getPortfolioSummaryHandler(req, res, next);

  assert.ok(nextError instanceof AppError);
  assert.equal((nextError as AppError).statusCode, 400);
  assert.equal((nextError as AppError).message, 'Invalid userId');
});

test('getPortfolioSummaryHandler returns portfolio payload from service', async () => {
  const originalGetPortfolioSummaryByUser = portfolioModule.portfolioService.getPortfolioSummaryByUser;
  const portfolio = {
    totalAccountValue: 1500,
    availableCash: 500,
    positions: [{ instrumentId: 1, ticker: 'AAPL', name: 'Apple', quantity: 10, marketValue: 1000, totalReturnPct: 12.5 }],
  };
  let receivedUserId: number | undefined;

  portfolioModule.portfolioService.getPortfolioSummaryByUser = async (userId: number) => {
    receivedUserId = userId;
    return portfolio;
  };

  try {
    const req = { params: { userId: '42' } } as unknown as Request;
    const res = createMockResponse();
    let nextCalled = false;
    const next: NextFunction = (error?: unknown) => {
      nextCalled = Boolean(error);
    };

    await getPortfolioSummaryHandler(req, res, next);

    assert.equal(receivedUserId, 42);
    assert.equal(nextCalled, false);
    assert.deepEqual(res.body, portfolio);
  } finally {
    portfolioModule.portfolioService.getPortfolioSummaryByUser = originalGetPortfolioSummaryByUser;
  }
});

test('getPortfolioSummaryHandler forwards service errors', async () => {
  const originalGetPortfolioSummaryByUser = portfolioModule.portfolioService.getPortfolioSummaryByUser;
  const expectedError = new Error('portfolio failed');
  portfolioModule.portfolioService.getPortfolioSummaryByUser = async () => {
    throw expectedError;
  };

  try {
    const req = { params: { userId: '42' } } as unknown as Request;
    const res = createMockResponse();
    let nextError: unknown;
    const next: NextFunction = (error?: unknown) => {
      nextError = error;
    };

    await getPortfolioSummaryHandler(req, res, next);

    assert.equal(nextError, expectedError);
  } finally {
    portfolioModule.portfolioService.getPortfolioSummaryByUser = originalGetPortfolioSummaryByUser;
  }
});