import { Injectable } from '@nestjs/common';
import { Db } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  /** Keeps the cached rating on Product in step with its published reviews. */
  async refreshRating(db: Db, productId: string) {
    const agg = await db.review.aggregate({
      where: { productId, status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await db.product.update({
      where: { id: productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
    });
  }
}
