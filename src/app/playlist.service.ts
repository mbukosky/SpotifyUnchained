import { Injectable } from '@angular/core';
import { PlaylistItem, ApiResponse } from './api-format';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap, map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PlaylistService {
  private totalItems: number;

  constructor(private httpClient: HttpClient) {

  }

  getPlaylists(pageNumber: number, pageSize: number, sort: string)
    : Observable<PlaylistItem[]> {
    return this.httpClient.get<ApiResponse>('/spotify', {
      params: new HttpParams()
        .set('page', String(pageNumber + 1))
        .set('size', String(pageSize))
        .set('sort', sort)
    }).pipe(
      tap(res => {
        this.totalItems = res.count;
      }),
      map(res => res.items)
    );
  }

  getTotalItems(): number {
    return this.totalItems;
  }

}
