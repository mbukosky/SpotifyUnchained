import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaylistsComponent } from './playlists.component';
import { PlaylistService } from '../playlist.service';
import { of } from 'rxjs';

describe('PlaylistsComponent', () => {
  let component: PlaylistsComponent;
  let fixture: ComponentFixture<PlaylistsComponent>;

  const playlistService = jasmine.createSpyObj('PlaylistsService', ['getPlaylists', 'getTotalItems']);
  const mockPlaylistResponse = {};
  playlistService.getPlaylists.and.returnValue(of(mockPlaylistResponse));

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [PlaylistsComponent],
      providers: [{ provide: PlaylistService, useValue: playlistService }]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaylistsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
