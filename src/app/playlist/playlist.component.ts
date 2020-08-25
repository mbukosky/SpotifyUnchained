import { Component, OnInit, Input } from '@angular/core';
import { PlaylistItem } from '../api-format';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SpotifyService } from '../spotify.service';
import { map, filter } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-playlist',
  templateUrl: './playlist.component.html',
  styleUrls: ['./playlist.component.css']
})
export class PlaylistComponent implements OnInit {

  @Input() playlist: PlaylistItem;

  constructor(private snackBar: MatSnackBar, private spotify: SpotifyService) { }

  ngOnInit(): void {
  }

  savePlaylist(): void {
    this.snackBar.open('Saving playlist is currently unsupported', 'OK', {
      duration: 2000,
    });
  }

  userHasPlaylist(): Observable<boolean> {
    if (this.spotify.isLoggedIn()) {
      return this.spotify.getUserSavedPlaylists().pipe(
        map(playlists => playlists ? playlists.items : []),
        map(items => items.filter(item => item.name === this.playlist.title)),
        map(items => items.length !== 0),
      );
    }
    return of(false);
  }

}
