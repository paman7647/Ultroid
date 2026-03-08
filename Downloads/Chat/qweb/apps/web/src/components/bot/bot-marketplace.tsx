'use client';

import { useState, useEffect } from 'react';
import { Bot, Download, Star, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BotBadge } from './bot-badge';
import { apiGet, apiPost } from '@/lib/api';

interface MarketplaceListing {
  id: string;
  bot: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    botDescription: string | null;
  };
  category: string;
  tags: string[];
  shortDescription: string;
  longDescription: string;
  installCount: number;
  reviews: Array<{ rating: number }>;
  averageRating: number;
}

const CATEGORIES = [
  'ALL',
  'MODERATION',
  'MUSIC',
  'GAME',
  'UTILITY',
  'AI',
  'AUTOMATION',
  'OTHER',
] as const;

export function BotMarketplace() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListings();
  }, [category]);

  async function fetchListings() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'ALL') params.set('category', category);
      if (search) params.set('search', search);
      const data = await apiGet<{ listings?: MarketplaceListing[] } & MarketplaceListing[]>(`/marketplace?${params.toString()}`);
      setListings((data as { listings?: MarketplaceListing[] }).listings ?? (data as unknown as MarketplaceListing[]));
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }

  async function installBot(listingId: string, roomId: string) {
    await apiPost(`/marketplace/${listingId}/install`, { roomId });
    fetchListings();
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-indigo-400" />
        <h2 className="text-xl font-bold">Bot Marketplace</h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          aria-label="Search bots"
          placeholder="Search bots..."
          className="w-full rounded-lg border bg-background py-2 pl-10 pr-4 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchListings()}
        />
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            type="button"
            size="sm"
            variant={category === cat ? 'default' : 'outline'}
            onClick={() => setCategory(cat)}
          >
            {cat.charAt(0) + cat.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      {/* Listings grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : listings.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No bots found
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <Card key={listing.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20">
                  <Bot className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">
                      {listing.bot.displayName}
                    </span>
                    <BotBadge />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    @{listing.bot.username}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {listing.shortDescription}
              </p>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  {listing.installCount}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-400" />
                  {listing.averageRating?.toFixed(1) ?? '—'}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5">
                  {listing.category}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
