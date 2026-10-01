import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import HubOrder from "@/models/HubOrder";
import CourierRequest from "@/models/CourierRequest";
import Client from "@/models/Client";
import { requirePermission } from "@/middleware/adminAuth";
import { hasPermission } from "@/lib/permissions";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "orders.view");
    if (admin instanceof NextResponse) return admin;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    await connectToDatabase();

    const order = await HubOrder.findById(params.id).lean();
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const [courier, customer] = await Promise.all([
      CourierRequest.findOne({ hubOrderId: String(order._id) })
        .select("status courierName courierPhone riderEarningKobo updatedAt")
        .lean(),
      Client.findById(order.clientId).select("name email phone").lean(),
    ]);

    // The revenue split is for roles that see reports (Finance, Super Admin).
    const seesSplit = hasPermission(admin.role, "reports.view");

    return NextResponse.json({
      order: {
        _id: String(order._id),
        orderNumber: order.orderNumber,
        status: order.status,
        vendorName: order.vendorName,
        vehicleType: order.vehicleType,
        items: order.items ?? [],
        subtotalKobo: order.subtotalKobo,
        deliveryFeeKobo: order.deliveryFeeKobo,
        totalKobo: order.totalKobo,
        payment: {
          status: order.payment?.status ?? "",
          paidAt: order.payment?.paidAt ?? null,
          channel: order.payment?.channel ?? "",
          reference: order.payment?.reference ?? "",
        },
        delivery: order.delivery ?? {},
        createdAt: order.createdAt,
        vendorAcceptedAt: order.vendorAcceptedAt ?? null,
        readyForPickupAt: order.readyForPickupAt ?? null,
        cancelledBy: order.cancelledBy ?? null,
        cancelReason: order.cancelReason ?? null,
        refund: order.refund?.status ? order.refund : null,
      },
      customer: customer
        ? { name: customer.name, email: customer.email, phone: customer.phone }
        : null,
      courier: courier
        ? {
            status: courier.status,
            name: courier.courierName,
            phone: courier.courierPhone,
            ...(seesSplit ? { earningKobo: courier.riderEarningKobo } : {}),
          }
        : null,
      split: seesSplit
        ? {
            vendorTier: order.vendorTier,
            vendorPayoutKobo: order.vendorPayoutKobo,
            platformVendorRevenueKobo: order.platformVendorRevenueKobo,
            riderEarningKobo: order.riderEarningKobo,
            platformCommissionKobo: order.platformCommissionKobo,
          }
        : null,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/orders/[id]");
  }
}