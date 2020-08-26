import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, from, BehaviorSubject, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { tap } from 'rxjs/operators';
import { Location } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class SpotifyService {

  private apiBase = 'https://api.spotify.com/v1';
  private tokenName = 'spotify-token';
  private expirationName = 'spotify-token-expiration';
  private clientId = environment.spotifyClientId;
  private redirectUri = window.location.origin;
  private scope = 'playlist-read-private playlist-modify-private';

  private authToken: string;
  private loggedIn = false;
  private timeout: number;

  private userSubject: BehaviorSubject<SpotifyApi.CurrentUsersProfileResponse>
    = new BehaviorSubject(null);
  private playlistsSubject:
    BehaviorSubject<SpotifyApi.ListOfCurrentUsersPlaylistsResponse>
    = new BehaviorSubject(null);

  constructor(private httpClient: HttpClient, private location: Location) {
    // TODO: this probably isn't the best location to do this
    window.onload = () => {
      // Save token from hash if available
      const hash = window.location.hash;
      if (window.location.search.substring(1).indexOf('error') !== -1) {
        location.replaceState('/');
      } else if (hash) {
        const spotifyToken = window.location.hash.split('&')[0].split('=')[1];
        const expiration = new Date().getTime() +
          (1000 * Number(window.location.hash.split('&')[2].split('=')[1]));
        localStorage.setItem('spotify-token', spotifyToken);
        localStorage.setItem('spotify-token-expiration', String(expiration));
        location.replaceState('/');
      }
      // Load token and initialize user
      const token = localStorage.getItem(this.tokenName);
      if (token) {
        const expiration = localStorage
          .getItem(this.expirationName);
        const currentTime = new Date().getTime();
        if (expiration && Number(expiration) > currentTime + 120000) {
          const remainingTime = Number(expiration) - currentTime - 100000;
          console.log(`Token expires in ${remainingTime} ms`);
          this.timeout = setTimeout(() => this.logout(), remainingTime);
          this.authToken = token;
          this.loggedIn = true;
          this.initializeUser();
          return true;
        }
      }
    };
  }

  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  login(): void {
    const params = {
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope || '',
      response_type: 'token'
    };
    window.location.href = 'https://accounts.spotify.com/authorize?' +
      this.toQueryString(params);
  }

  logout(): void {
    // TODO: logout from spotify.com as well?
    console.log('logout');
    this.userSubject.next(null);
    this.loggedIn = false;
    clearTimeout(this.timeout);
    localStorage.removeItem(this.tokenName);
    localStorage.removeItem(this.expirationName);
  }

  initializeUser(): void {
    this.downloadUserInfo().subscribe(profile => {
      this.userSubject.next(profile);
    });
    this.downloadUserSavedPlaylists().subscribe(playlists => {
      this.playlistsSubject.next(playlists);
    });
  }

  getCurrentUser(): Observable<SpotifyApi.CurrentUsersProfileResponse> {
    return this.userSubject.asObservable();
  }

  getUserSavedPlaylists(): Observable<SpotifyApi.ListOfCurrentUsersPlaylistsResponse> {
    return this.playlistsSubject.asObservable();
  }

  createPlaylist(playlistName: string):
    Observable<SpotifyApi.CreatePlaylistResponse> {
    if (!this.userSubject.getValue()) {
      return throwError('Must be signed in to create playlist');
    }

    return this.httpClient.post<SpotifyApi.CreatePlaylistResponse>
      (this.apiBase + `/users/${this.userSubject.getValue().id}/playlists`,
        {
          name: playlistName,
          public: false
        },
        {
          headers: this.getAuthHeader().set('Content-Type', 'application/json'),
        }).pipe(
          // Manually add the playlist to the local list
          tap({ complete: () => this.downloadUserSavedPlaylists().subscribe() })
        );
  }

  addPlaylistTracks(playlistId: string, trackUris: string[]):
    Observable<SpotifyApi.AddTracksToPlaylistResponse> {

    if (trackUris.length > 100) {
      console.log('A maximum of 100 items can be added in one request.');
    }

    return this.httpClient.post<SpotifyApi.AddTracksToPlaylistResponse>(
      this.apiBase + `/playlists/${playlistId}/tracks`,
      {
        uris: trackUris
      },
      {
        headers: this.getAuthHeader().set('Content-Type', 'application/json'),
      }
    );
  }

  private downloadUserInfo(): Observable<SpotifyApi.CurrentUsersProfileResponse> {
    return this.httpClient.get<SpotifyApi.CurrentUsersProfileResponse>
      (this.apiBase + '/me', {
        headers: this.getAuthHeader(),
      });
  }

  private downloadUserSavedPlaylists():
    Observable<SpotifyApi.ListOfCurrentUsersPlaylistsResponse> {
    // TODO: do more requests if a user has over 50 playlists
    return this.httpClient.get<SpotifyApi.ListOfCurrentUsersPlaylistsResponse>(this.apiBase + '/me/playlists', {
      headers: this.getAuthHeader(),
      params: new HttpParams().set('limit', '50'),
    }).pipe(tap(playlists => this.playlistsSubject.next(playlists)));
  }

  private toQueryString(obj): string {
    const parts = [];
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        parts.push(encodeURIComponent(key) + '=' +
          encodeURIComponent(obj[key]));
      }
    }
    return parts.join('&');
  }

  private getAuthHeader(): HttpHeaders {
    return new HttpHeaders().set('Authorization', 'Bearer ' + this.authToken);
  }
}
