import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountController } from './account/account.controller';
import { AdminCatalogController } from './admin/admin-catalog.controller';
import { AdminMarketingController } from './admin/admin-marketing.controller';
import { AdminOrdersController } from './admin/admin-orders.controller';
import { AdminOverviewController } from './admin/admin-overview.controller';
import { AftersaleController } from './aftersale/aftersale.controller';
import { ReviewsService } from './aftersale/reviews.service';
import { AuthController } from './auth/auth.controller';
import { CartController } from './cart/cart.controller';
import { CartService } from './cart/cart.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { SearchService } from './catalog/search.service';
import { CheckoutController } from './checkout/checkout.controller';
import { CheckoutService } from './checkout/checkout.service';
import { AuthGuard } from './common/auth';
import { EngagementService } from './common/engagement.service';
import { PricingService } from './common/pricing.service';
import { SettingsService } from './common/settings.service';
import { EngagementController } from './engagement/engagement.controller';
import { HealthController } from './health.controller';
import { JobsService } from './jobs/jobs.service';
import { OrderWorkflowService } from './orders/order-workflow.service';
import { OrdersController } from './orders/orders.controller';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import { PrismaService } from './prisma/prisma.service';
import { UploadsController } from './uploads/uploads.controller';

/** Shared services every feature uses. */
@Global()
@Module({
  providers: [PrismaService, SettingsService, PricingService, EngagementService, OrderWorkflowService, ReviewsService],
  exports: [PrismaService, SettingsService, PricingService, EngagementService, OrderWorkflowService, ReviewsService],
})
class CoreModule {}

@Module({ controllers: [AuthController, AccountController] })
class IdentityModule {}

@Module({ controllers: [CatalogController], providers: [CatalogService, SearchService], exports: [CatalogService] })
class CatalogModule {}

@Module({
  controllers: [CartController, CheckoutController, OrdersController, PaymentsController],
  providers: [CartService, CheckoutService, PaymentsService],
  exports: [PaymentsService],
})
class ShoppingModule {}

@Module({ controllers: [AftersaleController, EngagementController, UploadsController] })
class CustomerCareModule {}

@Module({
  imports: [CatalogModule],
  controllers: [AdminCatalogController, AdminOrdersController, AdminMarketingController, AdminOverviewController],
})
class AdminModule {}

@Module({ imports: [ShoppingModule], providers: [JobsService] })
class JobsModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-only-secret',
      signOptions: { expiresIn: `${Number(process.env.JWT_EXPIRES_DAYS || 7)}d` },
    }),
    ScheduleModule.forRoot(),
    CoreModule,
    IdentityModule,
    CatalogModule,
    ShoppingModule,
    CustomerCareModule,
    AdminModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
