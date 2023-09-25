import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpHeaders } from '@angular/common/http';

@Injectable()
export class CacheInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    let headers;
    if (req.headers.keys().length > 0) {
      headers = req.headers
        .append('Cache-Control', 'no-cache')
        .append('Pragma', 'no-cache')
        .append('Expires', 'Sat, 01 Jan 2000 00:00:00 GMT');
    } else {
      headers = new HttpHeaders({
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': 'Sat, 01 Jan 2000 00:00:00 GMT'
        });
    }
    const httpRequest = req.clone({
      headers
    });

    return next.handle(httpRequest);
  }
}