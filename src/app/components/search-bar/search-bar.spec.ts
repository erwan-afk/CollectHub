import { TestBed } from '@angular/core/testing';
import { SearchBar } from './search-bar';
import { provideZonelessChangeDetection } from '@angular/core';

describe('SearchBar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchBar],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(SearchBar);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should emit submit event on searchClick', () => {
    const fixture = TestBed.createComponent(SearchBar);
    const component = fixture.componentInstance;
    let emitted = false;
    component.searchButtonClicked.subscribe(() => (emitted = true));
    component.searchClick();
    expect(emitted).toBe(true);
  });

  it('should have default search value', () => {
    const fixture = TestBed.createComponent(SearchBar);
    expect(fixture.componentInstance.search()).toBe('Initial');
  });
});
