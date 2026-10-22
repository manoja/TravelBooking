import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(catchError((err: HttpErrorResponse) => throwError(() => err)));
};

export function errorMessage(err: unknown): string {
  const e = err as HttpErrorResponse;
  const detail = e?.error?.detail ?? e?.error?.message;
  if (typeof detail === 'string') return detail;
  if (e?.status === 0) return 'Cannot reach the server.';
  return 'Something went wrong. Please try again.';
}
