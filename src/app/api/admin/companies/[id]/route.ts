import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { hasPermission } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/** GET /api/admin/companies/[id]. Documents only for companies.review. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "companies.view");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    await connectToDatabase();

    const company = await Company.findById(params.id).lean();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const canReview = hasPermission(admin.role, "companies.review");
    const safe: Record<string, unknown> = { ...company };
    if (!canReview) delete safe.documents;

    return NextResponse.json({ company: safe, canReview });
  } catch (err) {
    return apiError(err, "GET /api/admin/companies/[id]");
  }
}

/**
 * PATCH /api/admin/companies/[id]
 * body: { action: "record_agreement" | "approve" | "reject" | "suspend" | "warn", ... }
 *  - record_agreement: { version, signedAt?, notes? }. Saves that the owner
 *    signed the agreement at the office.
 *  - approve: only works once the agreement is recorded. Also reinstates a
 *    rejected or suspended company.
 *  - reject / suspend: { reason } (at least 5 characters).
 *  - warn: { reason, reportId? }. Needs chat.moderate (Support can do it).
 *    The other actions need companies.review.
 * status is the source of truth; isApproved always follows it.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (!["record_agreement", "approve", "reject", "suspend", "warn"].includes(action)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const admin = await requirePermission(req, action === "warn" ? "chat.moderate" : "companies.review");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    await connectToDatabase();

    const company = await Company.findById(params.id).lean();
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const before = {
      status: company.status,
      isApproved: company.isApproved,
      agreement: company.agreement,
    };

    if (action === "warn") {
      const reason = String(body.reason ?? "").trim().slice(0, 300);
      if (reason.length < 5) {
        return NextResponse.json({ error: "Enter a reason (at least 5 characters)." }, { status: 400 });
      }
      const reportId = mongoose.isValidObjectId(body.reportId) ? String(body.reportId) : undefined;
      const warning = {
        reason,
        issuedByUid: admin.uid,
        issuedByName: admin.name,
        issuedAt: new Date(),
        ...(reportId ? { reportId } : {}),
      };
      await Company.updateOne({ _id: params.id }, { $push: { warnings: warning } });
      const warningCount = (company.warnings?.length ?? 0) + 1;

      await logAudit(admin, {
        action: "company.warn",
        targetType: "Company",
        targetId: params.id,
        summary: `Warned company ${company.businessName} (warning ${warningCount}): ${reason}`,
        after: { warning, warningCount },
      });
      return NextResponse.json({ ok: true, warningCount });
    }

    if (action === "record_agreement") {
      const version = String(body.version ?? "").trim();
      if (version.length < 1 || version.length > 40) {
        return NextResponse.json({ error: "Enter the agreement version." }, { status: 400 });
      }
      const signedAt = body.signedAt ? new Date(body.signedAt) : new Date();
      if (Number.isNaN(signedAt.getTime()) || signedAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "Enter a valid signing date that is not in the future." },
          { status: 400 }
        );
      }
      const notes = String(body.notes ?? "").trim().slice(0, 300);

      const agreement = {
        signed: true,
        version,
        signedAt,
        recordedByUid: admin.uid,
        recordedByName: admin.name,
        notes,
      };
      await Company.updateOne({ _id: params.id }, { $set: { agreement } });

      await logAudit(admin, {
        action: "company.record_agreement",
        targetType: "Company",
        targetId: params.id,
        summary: `Recorded signed agreement ${version} for ${company.businessName}`,
        before,
        after: { agreement },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "approve") {
      if (!company.agreement?.signed) {
        return NextResponse.json(
          { error: "Record the signed agreement before approving this company." },
          { status: 409 }
        );
      }
      await Company.updateOne(
        { _id: params.id },
        {
          $set: { status: "approved", isApproved: true, verified: true },
          $unset: { statusReason: "" },
        }
      );
      await logAudit(admin, {
        action: "company.approve",
        targetType: "Company",
        targetId: params.id,
        summary: `Approved company ${company.businessName}`,
        before,
        after: { status: "approved", isApproved: true, verified: true },
      });
      return NextResponse.json({ ok: true });
    }

    // reject or suspend
    const reason = String(body.reason ?? "").trim().slice(0, 300);
    if (reason.length < 5) {
      return NextResponse.json({ error: "Enter a reason (at least 5 characters)." }, { status: 400 });
    }
    const newStatus = action === "reject" ? "rejected" : "suspended";
    await Company.updateOne(
      { _id: params.id },
      {
        $set: {
          status: newStatus,
          isApproved: false,
          verified: false,
          isOnline: false,
          statusReason: reason,
        },
      }
    );
    await logAudit(admin, {
      action: action === "reject" ? "company.reject" : "company.suspend",
      targetType: "Company",
      targetId: params.id,
      summary: `${action === "reject" ? "Rejected" : "Suspended"} company ${company.businessName}: ${reason}`,
      before,
      after: { status: newStatus, isApproved: false, reason },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/companies/[id]");
  }
}