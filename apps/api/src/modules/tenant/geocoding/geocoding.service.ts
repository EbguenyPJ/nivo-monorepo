import { Injectable, Logger } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { CustomerAddress } from '@nivo/database';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const RATE_LIMIT_MS = 1_000;

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private lastRequestAt = 0;

  /**
   * Geocode a free-form address string using Nominatim (OpenStreetMap).
   * Returns { lat, lng } or null if no result found.
   */
  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    // Rate-limit: ensure at least 1 s between requests
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < RATE_LIMIT_MS) {
      await this.delay(RATE_LIMIT_MS - elapsed);
    }

    const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(address)}&limit=1`;

    try {
      this.lastRequestAt = Date.now();
      const response = await fetch(url, {
        headers: { 'User-Agent': 'NivoPOS/1.0' },
      });

      if (!response.ok) {
        this.logger.warn(`Nominatim returned ${response.status} for: ${address}`);
        return null;
      }

      const results = (await response.json()) as any[];

      if (!results.length) {
        this.logger.debug(`No geocoding results for: ${address}`);
        return null;
      }

      return {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon),
      };
    } catch (error) {
      this.logger.error(`Geocoding failed for "${address}": ${error}`);
      return null;
    }
  }

  /**
   * Load a CustomerAddress by ID, build a human-readable address string,
   * geocode it and persist the lat/lng back to the row.
   */
  async geocodeAddress(conn: DataSource, addressId: string): Promise<void> {
    const repo = conn.getRepository(CustomerAddress);
    const address = await repo.findOne({ where: { id: addressId } });

    if (!address) {
      this.logger.warn(`CustomerAddress ${addressId} not found`);
      return;
    }

    const parts = [address.street, address.city, address.state, address.country].filter(Boolean);
    const query = parts.join(', ');

    if (!query) {
      this.logger.debug(`Address ${addressId} has no geocodable fields`);
      return;
    }

    const coords = await this.geocode(query);

    if (coords) {
      await repo.update(addressId, {
        latitude: coords.lat,
        longitude: coords.lng,
      });
      this.logger.debug(`Geocoded address ${addressId} → ${coords.lat}, ${coords.lng}`);
    }
  }

  /**
   * Backfill lat/lng for every CustomerAddress where latitude IS NULL.
   * Returns the number of addresses processed.
   */
  async backfillAll(conn: DataSource): Promise<number> {
    const repo = conn.getRepository(CustomerAddress);
    const addresses = await repo.find({
      where: { latitude: IsNull() },
    });

    this.logger.log(`Backfilling geocoding for ${addresses.length} addresses`);

    for (const address of addresses) {
      await this.geocodeAddress(conn, address.id);
      // Slightly more than 1 s to stay well within Nominatim rate limits
      await this.delay(1_100);
    }

    return addresses.length;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
