import { Component, OnInit, Input } from '@angular/core';
import { PlaylistItem } from '../api-format';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SpotifyService } from '../spotify.service';
import { map, filter, switchMap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

@Component({
  selector: 'app-playlist',
  templateUrl: './playlist.component.html',
  styleUrls: ['./playlist.component.css']
})
export class PlaylistComponent implements OnInit {

  @Input() playlist: PlaylistItem;

  loading = false;

  constructor(private snackBar: MatSnackBar, private spotify: SpotifyService) { }

  ngOnInit(): void {
  }

  savePlaylist(): void {
    event.stopPropagation();
    this.loading = true;
    this.spotify.createPlaylist(this.playlist.title)
      .pipe(
        switchMap(playlistResp => {
          const uris = this.playlist.tracks.map(track => track.uri);
          // TODO: make multiple requests if more than 100 tracks
          return this.spotify.addPlaylistTracks(playlistResp.id, uris);
        })).subscribe(addResp => {
          console.log(addResp);
          this.loading = false;
          this.snackBar.open('Saved tracks to playlist', 'OK', {
            duration: 2000,
          });
        },
          err => {
            this.snackBar.open('You must be signed in to save a playlist', 'OK', {
              duration: 2000,
            });
            console.error(err);
            this.loading = false;
          },
        );
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
