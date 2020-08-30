import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackComponent } from './track.component';

describe('TrackComponent', () => {
  let component: TrackComponent;
  let fixture: ComponentFixture<TrackComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [TrackComponent]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TrackComponent);
    component = fixture.componentInstance;
    component.track = {
      created: '2020-08-20T15:28:00.263Z',
      _id: '0',
      id: 'abcd',
      name: 'Track title',
      artist: 'Track artist',
      added_at: '2020-08-21T15:28:00.263Z',
      open_url: 'https://open.spotify.com/track/abcd',
      uri: 'spotify:track:abcd'
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
