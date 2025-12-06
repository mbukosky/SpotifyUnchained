import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
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
  private refreshTokenName = 'spotify-refresh-token';
  private codeVerifierName = 'spotify-code-verifier';
  private clientId = environment.spotifyClientId;
  private redirectUri = this.getRedirectUri();
  private scope = 'playlist-read-private playlist-modify-private';

  private getRedirectUri(): string {
    // Spotify requires 127.0.0.1 instead of localhost for loopback addresses
    return window.location.origin.replace('localhost', '127.0.0.1');
  }

  private authToken: string;
  private loggedIn = false;
  private timeout: number;

  userSubject: BehaviorSubject<SpotifyApi.CurrentUsersProfileResponse>
    = new BehaviorSubject(null);
  playlistsSubject:
    BehaviorSubject<SpotifyApi.ListOfCurrentUsersPlaylistsResponse>
    = new BehaviorSubject(null);

  constructor(private httpClient: HttpClient, private location: Location) { }

  // PKCE helper: Generate a random code verifier
  private generateCodeVerifier(): string {
    const array = new Uint8Array(64);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  // PKCE helper: Generate code challenge from verifier
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  // Base64 URL encode (no padding, URL-safe characters)
  private base64UrlEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  loadOrSaveToken(): void {
    // Check for error in URL
    if (window.location.search.indexOf('error') !== -1) {
      console.error('OAuth error:', window.location.search);
      this.location.replaceState('/');
      return;
    }

    // Check for authorization code in URL (PKCE flow)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      this.exchangeCodeForToken(code);
      return;
    }

    // Load existing token and initialize user
    this.loadExistingToken();
  }

  private exchangeCodeForToken(code: string): void {
    const codeVerifier = sessionStorage.getItem(this.codeVerifierName);
    if (!codeVerifier) {
      console.error('No code verifier found');
      this.location.replaceState('/');
      return;
    }

    // Clear the URL immediately
    this.location.replaceState('/');

    // Exchange code for tokens via backend
    this.httpClient.post<{access_token: string; expires_in: number; refresh_token: string}>(
      '/api/spotify/token',
      {
        code,
        code_verifier: codeVerifier,
        redirect_uri: this.redirectUri
      }
    ).subscribe({
      next: (response) => {
        // Clear code verifier from session storage
        sessionStorage.removeItem(this.codeVerifierName);

        // Store tokens
        const expiration = new Date().getTime() + (1000 * response.expires_in);
        localStorage.setItem(this.tokenName, response.access_token);
        localStorage.setItem(this.expirationName, String(expiration));
        if (response.refresh_token) {
          localStorage.setItem(this.refreshTokenName, response.refresh_token);
        }

        // Initialize session
        this.authToken = response.access_token;
        this.loggedIn = true;
        this.scheduleTokenRefresh(response.expires_in);
        this.initializeUser();
      },
      error: (err) => {
        console.error('Token exchange failed:', err);
        sessionStorage.removeItem(this.codeVerifierName);
      }
    });
  }

  private loadExistingToken(): void {
    const token = localStorage.getItem(this.tokenName);
    if (token) {
      const expiration = localStorage.getItem(this.expirationName);
      const currentTime = new Date().getTime();
      if (expiration && Number(expiration) > currentTime + 120000) {
        const remainingTime = Number(expiration) - currentTime - 100000;
        console.log(`Token expires in ${remainingTime} ms`);
        this.authToken = token;
        this.loggedIn = true;
        this.scheduleTokenRefresh(remainingTime / 1000);
        this.initializeUser();
      } else {
        // Token expired or expiring soon, try to refresh
        this.tryRefreshToken();
      }
    }
  }

  private scheduleTokenRefresh(expiresInSeconds: number): void {
    // Refresh 5 minutes before expiration
    const refreshTime = Math.max((expiresInSeconds - 300) * 1000, 60000);
    console.log(`Scheduling token refresh in ${refreshTime} ms`);
    clearTimeout(this.timeout);
    this.timeout = window.setTimeout(() => this.tryRefreshToken(), refreshTime);
  }

  private tryRefreshToken(): void {
    const refreshToken = localStorage.getItem(this.refreshTokenName);
    if (!refreshToken) {
      console.log('No refresh token available, logging out');
      this.logout();
      return;
    }

    this.httpClient.post<{access_token: string; expires_in: number; refresh_token?: string}>(
      '/api/spotify/refresh',
      { refresh_token: refreshToken }
    ).subscribe({
      next: (response) => {
        const expiration = new Date().getTime() + (1000 * response.expires_in);
        localStorage.setItem(this.tokenName, response.access_token);
        localStorage.setItem(this.expirationName, String(expiration));
        if (response.refresh_token) {
          localStorage.setItem(this.refreshTokenName, response.refresh_token);
        }

        this.authToken = response.access_token;
        this.loggedIn = true;
        this.scheduleTokenRefresh(response.expires_in);

        // Re-initialize user if not already logged in
        if (!this.userSubject.getValue()) {
          this.initializeUser();
        }
      },
      error: (err) => {
        console.error('Token refresh failed:', err);
        this.logout();
      }
    });
  }

  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  async login(): Promise<void> {
    // Generate PKCE code verifier and challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    // Store code verifier for later exchange
    sessionStorage.setItem(this.codeVerifierName, codeVerifier);

    const params = {
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope || '',
      response_type: 'code',
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    };
    window.location.href = 'https://accounts.spotify.com/authorize?' +
      this.toQueryString(params);
  }

  logout(): void {
    console.log('logout');
    this.userSubject.next(null);
    this.loggedIn = false;
    clearTimeout(this.timeout);
    localStorage.removeItem(this.tokenName);
    localStorage.removeItem(this.expirationName);
    localStorage.removeItem(this.refreshTokenName);
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
