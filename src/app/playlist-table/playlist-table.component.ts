import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTable } from '@angular/material/table';
import { PlaylistItem } from '../api-format';
import { PlaylistTableDataSource } from './playlist-table-datasource';
import { PlaylistService } from '../playlist.service';
import { merge } from 'rxjs';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-playlist-table',
  templateUrl: './playlist-table.component.html',
  styleUrls: ['./playlist-table.component.scss']
})
export class PlaylistTableComponent implements AfterViewInit, OnInit {
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatTable) table: MatTable<PlaylistItem>;
  dataSource: PlaylistTableDataSource;

  /** Columns displayed in the table. Columns IDs can be added, removed, or reordered. */
  displayedColumns = ['name'];

  constructor(private playlistService: PlaylistService) {

  }

  ngOnInit(): void {
    this.dataSource = new PlaylistTableDataSource(this.playlistService);
    this.dataSource.loadPlaylists(0, 10, 'desc');
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.table.dataSource = this.dataSource;

    this.sort.sortChange.subscribe(() => this.paginator.pageIndex = 0);
    merge(this.sort.sortChange, this.paginator.page)
      .pipe(tap(() => this.loadPlaylistsPage()))
      .subscribe();
  }

  loadPlaylistsPage(): void {
    this.dataSource.loadPlaylists(this.paginator.pageIndex, this.paginator.pageSize, this.sort.direction);
  }
}
