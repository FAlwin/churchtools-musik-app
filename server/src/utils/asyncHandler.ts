import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wickelt einen async-Handler so, dass geworfene Fehler an den Error-Handler gehen. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
