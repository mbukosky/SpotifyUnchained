import { Injectable } from '@angular/core';
import { PlaylistItem, ApiResponse } from './api-format';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap, map } from 'rxjs/operators';
import { Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PlaylistService {
  private totalItems = 0;
  private selectedRegionSubject = new BehaviorSubject<string>(
    localStorage.getItem('selectedRegion') || 'all'
  );
  selectedRegion$ = this.selectedRegionSubject.asObservable();

  constructor(private httpClient: HttpClient) {

  }

  getPlaylists(pageNumber: number, pageSize: number, sort: string, region?: string)
    : Observable<PlaylistItem[]> {
    let params = new HttpParams()
      .set('page', String(pageNumber + 1))
      .set('size', String(pageSize))
      .set('sort', sort);

    if (region && region !== 'all') {
      params = params.set('region', region);
    }

    return this.httpClient.get<ApiResponse>('/spotify', { params }).pipe(
      tap(res => {
        this.totalItems = res.count;
      }),
      map(res => res.items)
    );
  }

  getTotalItems(): number {
    return this.totalItems;
  }

  getSelectedRegion(): string {
    return this.selectedRegionSubject.value;
  }

  setSelectedRegion(region: string): void {
    localStorage.setItem('selectedRegion', region);
    this.selectedRegionSubject.next(region);
  }
}
