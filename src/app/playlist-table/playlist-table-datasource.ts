import { DataSource } from '@angular/cdk/collections';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { catchError, finalize } from 'rxjs/operators';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { PlaylistItem } from '../api-format';
import { PlaylistService } from '../playlist.service';

/**
 * Data source for the Playlists view. This class should
 * encapsulate all logic for fetching and manipulating the displayed data
 * (including sorting, pagination, and filtering).
 */
export class PlaylistTableDataSource extends DataSource<PlaylistItem> {
  paginator: MatPaginator;
  sort: MatSort;

  private playlistsSubject = new BehaviorSubject<PlaylistItem[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private playlistService: PlaylistService) {
    super();
  }

  /**
   * Connect this data source to the table. The table will only update when
   * the returned stream emits new items.
   * @returns A stream of the items to be rendered.
   */
  connect(): Observable<PlaylistItem[]> {
    return this.playlistsSubject.asObservable();
  }

  /**
   *  Called when the table is being destroyed. Use this function, to clean up
   * any open connections or free any held resources that were set up during connect.
   */
  disconnect(): void {
    this.playlistsSubject.complete();
    this.loadingSubject.complete();
  }

  loadPlaylists(pageNumber: number, pageSize: number, sort: string): void {
    this.loadingSubject.next(true);

    this.playlistService.getPlaylists(pageNumber, pageSize, sort).pipe(
      catchError(() => of([])), finalize(() => this.loadingSubject.next(false))
    ).subscribe((playlists) => this.playlistsSubject.next(playlists));
  }

  totalItems(): number {
    return this.playlistService.getTotalItems();
  }
}
