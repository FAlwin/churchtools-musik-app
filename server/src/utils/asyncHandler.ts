import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wickelt einen async-Handler so, dass geworfene Fehler an den Error-Handler gehen.
 *
 * Seit Express 5 (#415) reicht der Router abgelehnte Promises selbst an `next` weiter – nötig ist
 * das hier also nicht mehr. Es bleibt bewusst stehen: Der Umstieg sollte nichts am Verhalten ändern,
 * und diese Hülle an 67 Routen zu entfernen wäre ein eigener Umbau, der für sich geprüft werden will.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
