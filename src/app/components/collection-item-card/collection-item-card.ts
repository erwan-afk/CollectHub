import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CollectionItem } from '../../models/collection-item';

@Component({
  selector: 'collection-item-card',
  imports: [MatIconModule],
  templateUrl: './collection-item-card.html',
  styleUrl: './collection-item-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionItemCard {
  item = input.required<CollectionItem>();

  rarityAccentClass() {
    switch (this.item().rarity) {
      case 'Legendary':
        return 'bg-gradient-to-r from-amber-500 to-orange-400';
      case 'Rare':
        return 'bg-gradient-to-r from-indigo-500 to-violet-500';
      case 'Uncommon':
        return 'bg-gradient-to-r from-emerald-500 to-teal-400';
      default:
        return 'bg-zinc-700';
    }
  }

  rarityBadgeClass() {
    switch (this.item().rarity) {
      case 'Legendary':
        return 'text-amber-300 border-amber-400/50';
      case 'Rare':
        return 'text-indigo-300 border-indigo-400/50';
      case 'Uncommon':
        return 'text-emerald-300 border-emerald-400/50';
      default:
        return 'text-zinc-300 border-zinc-500/50';
    }
  }

  rarityGlowClass() {
    switch (this.item().rarity) {
      case 'Legendary':
        return 'hover:shadow-[0_8px_30px_-8px_rgba(245,158,11,0.35)]';
      case 'Rare':
        return 'hover:shadow-[0_8px_30px_-8px_rgba(99,102,241,0.35)]';
      case 'Uncommon':
        return 'hover:shadow-[0_8px_30px_-8px_rgba(16,185,129,0.35)]';
      default:
        return 'hover:shadow-lg hover:shadow-zinc-900';
    }
  }
}
