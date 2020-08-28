import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolbarComponent } from './toolbar.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { SpotifyService } from '../spotify.service';

describe('ToolbarComponent', () => {
  let component: ToolbarComponent;
  let fixture: ComponentFixture<ToolbarComponent>;

  const spotify = jasmine.createSpyObj('SpotifyService', ['getCurrentUser', 'isLoggedIn', 'login', 'logout', 'loadOrSaveToken']);

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [MatMenuModule, MatToolbarModule],
      declarations: [ToolbarComponent],
      providers: [{ provide: SpotifyService, useValue: spotify }]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
