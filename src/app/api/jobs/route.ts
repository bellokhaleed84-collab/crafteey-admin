import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Job } from "@/models/Job";
import { requirePermission } from "@/middleware/adminAuth";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

// GET: list all jobs (newest first)
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "jobs.view");
    if (admin instanceof NextResponse) return admin;

    await connectToDatabase();
    const jobs = await Job.find({}).sort({ createdAt: -1 }).limit(50);
    return NextResponse.json(jobs);
  } catch (err) {
    return apiError(err, "GET /api/admin/jobs");
  }
}

// POST: create a new unassigned job that enters the shared pool.
export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "jobs.manage");
    if (admin instanceof NextResponse) return admin;

    const body = await req.json().catch(() => null);
    const { category, clientName, clientPhone, address, scheduledFor, price, description } = body ?? {};

    if (!category || !clientName || !clientPhone || !address || !scheduledFor || !price || !description) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    await connectToDatabase();

    try {
      const job = await Job.create({
        technicianUid: null,
        category,
        clientName,
        clientPhone,
        address,
        scheduledFor,
        price: Number(price),
        description,
      });

      await logAudit(admin, {
        action: "job.create",
        targetType: "Job",
        targetId: String(job._id),
        summary: `Posted a ${category} job for ${clientName}`,
        after: { category, price: Number(price) },
      });

      return NextResponse.json(job, { status: 201 });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  } catch (err) {
    return apiError(err, "POST /api/admin/jobs");
  }
}