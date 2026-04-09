import path from 'node:path';

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

import {
  AppError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../errors.js';
import type { SubscriptionService } from '../subscriptions/subscription-service.js';

const PROTO_PATH = path.resolve(
  process.cwd(),
  'proto',
  'release_notification.proto'
);

interface LoadedGrpcSchema {
  release_notification: {
    v1: {
      SubscriptionService: {
        service: grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;
      };
    };
  };
}

export interface GrpcServerController {
  start(): Promise<void>;
  shutdown(): Promise<void>;
}

export function createSubscriptionGrpcServer(input: {
  subscriptionService: SubscriptionService;
  port: number;
}): GrpcServerController {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const schema = grpc.loadPackageDefinition(
    packageDefinition
  ) as unknown as LoadedGrpcSchema;
  const serviceDefinition =
    schema.release_notification.v1.SubscriptionService.service;
  const server = new grpc.Server();

  server.addService(serviceDefinition, {
    Subscribe: (
      call: grpc.ServerUnaryCall<
        { email?: string; repository?: string },
        { message: string }
      >,
      callback: grpc.sendUnaryData<{ message: string }>
    ) => {
      void handleUnary(callback, async () => {
        return input.subscriptionService.subscribe({
          email: call.request.email ?? '',
          repository: call.request.repository ?? '',
        });
      });
    },
    Confirm: (
      call: grpc.ServerUnaryCall<{ token?: string }, { message: string }>,
      callback: grpc.sendUnaryData<{ message: string }>
    ) => {
      void handleUnary(callback, async () => {
        return input.subscriptionService.confirm(call.request.token ?? '');
      });
    },
    Unsubscribe: (
      call: grpc.ServerUnaryCall<{ token?: string }, { message: string }>,
      callback: grpc.sendUnaryData<{ message: string }>
    ) => {
      void handleUnary(callback, async () => {
        return input.subscriptionService.unsubscribe(call.request.token ?? '');
      });
    },
    ListSubscriptions: (
      call: grpc.ServerUnaryCall<
        { email?: string },
        { email: string; subscriptions: string[] }
      >,
      callback: grpc.sendUnaryData<{ email: string; subscriptions: string[] }>
    ) => {
      void handleUnary(callback, async () => {
        return input.subscriptionService.listByEmail(call.request.email ?? '');
      });
    },
  });

  return {
    async start(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.bindAsync(
          `0.0.0.0:${input.port}`,
          grpc.ServerCredentials.createInsecure(),
          (error: Error | null) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          }
        );
      });
      server.start();
    },
    async shutdown(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.tryShutdown(error => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

async function handleUnary<TResponse>(
  callback: grpc.sendUnaryData<TResponse>,
  handler: () => Promise<TResponse>
): Promise<void> {
  try {
    const payload = await handler();
    callback(null, payload);
  } catch (error) {
    callback(toGrpcError(error), null);
  }
}

function toGrpcError(error: unknown): grpc.ServiceError {
  const normalized = new Error('Internal server error.') as grpc.ServiceError;
  normalized.code = grpc.status.INTERNAL;
  if (!(error instanceof Error)) {
    return normalized;
  }

  normalized.message = error.message;
  if (error instanceof ValidationError) {
    normalized.code = grpc.status.INVALID_ARGUMENT;
    return normalized;
  }
  if (error instanceof NotFoundError) {
    normalized.code = grpc.status.NOT_FOUND;
    return normalized;
  }
  if (error instanceof RateLimitError) {
    normalized.code = grpc.status.RESOURCE_EXHAUSTED;
    return normalized;
  }
  if (error instanceof AppError) {
    normalized.code = grpc.status.UNKNOWN;
    return normalized;
  }
  return normalized;
}
