import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { PlaylistComponent } from './playlist.component';
import { SpotifyService } from '../spotify.service';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

describe('PlaylistComponent', () => {
  let component: PlaylistComponent;
  let fixture: ComponentFixture<PlaylistComponent>;

  beforeEach(waitForAsync(() => {

    const spotify = jasmine.createSpyObj('SpotifyService', ['getUserSavedPlaylists', 'createPlaylist', 'isLoggedIn']);

    TestBed.configureTestingModule({
      imports: [MatSnackBarModule, MatExpansionModule, MatIconModule, MatProgressSpinnerModule, BrowserAnimationsModule],
      declarations: [PlaylistComponent],
      providers: [{ provide: SpotifyService, useValue: spotify }]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaylistComponent);
    component = fixture.componentInstance;
    component.playlist = {
      title: 'A title',
      tracks: [],
      published_date: '2020-01-01T07:00:00.000Z',
      _id: '0'
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
