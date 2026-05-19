import { TestBed } from '@angular/core/testing';
import { CollectionItemCard } from './collection-item-card';
import { CollectionItem } from '../../models/collection-item';
import { provideZonelessChangeDetection } from '@angular/core';

describe('CollectionItemCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionItemCard],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(CollectionItemCard);
    const item = new CollectionItem();
    item.name = 'Test';
    fixture.componentRef.setInput('item', item);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should return correct rarity accent class for Legendary', () => {
    const fixture = TestBed.createComponent(CollectionItemCard);
    const item = new CollectionItem();
    item.rarity = 'Legendary';
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
    expect(fixture.componentInstance.rarityAccentClass()).toContain('amber');
  });

  it('should return correct rarity badge class for Rare', () => {
    const fixture = TestBed.createComponent(CollectionItemCard);
    const item = new CollectionItem();
    item.rarity = 'Rare';
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
    expect(fixture.componentInstance.rarityBadgeClass()).toContain('indigo');
  });

  it('should return correct rarity glow class for Common', () => {
    const fixture = TestBed.createComponent(CollectionItemCard);
    const item = new CollectionItem();
    item.rarity = 'Common';
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
    expect(fixture.componentInstance.rarityGlowClass()).toContain('shadow');
  });
});
