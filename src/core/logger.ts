import { ApplicationEnvironentEnum } from './env';

interface Loggerer {
  logError(error: Error): void;
  logMessage(message: string): void;
}

class ConsoleLogger implements Loggerer {
  logError(error: Error) {
    console.error(error);
  }

  logMessage(message: string) {
    console.info(message);
  }
}

// Production keeps errors in the browser console and drops messages. An error
// reporting service can replace this class later without touching callers
// (the mobile app uses Crashlytics here).
class ProductionLogger implements Loggerer {
  logError(error: Error) {
    console.error(error);
  }

  logMessage(_message: string) {}
}

class Logger {
  constructor(private logger: Loggerer) {}

  logError(error: Error) {
    this.logger.logError(error);
  }

  logMessage(message: string) {
    this.logger.logMessage(message);
  }
}

let LoggerInstance: Logger | undefined;

export const setUpLogger = (environment: string) => {
  let logger: Loggerer;
  if (environment === ApplicationEnvironentEnum.enum.prod) {
    logger = new ProductionLogger();
  } else {
    logger = new ConsoleLogger();
  }
  LoggerInstance = new Logger(logger);
};

export default () => {
  if (LoggerInstance === undefined) {
    throw new Error(
      'Logger not initialized. Use setUpLogger to initialize it.',
    );
  }
  return LoggerInstance;
};
