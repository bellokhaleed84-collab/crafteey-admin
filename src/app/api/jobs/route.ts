import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Job } from "@/models/Job";
import { verifyAdminToken } from "@/middleware/adminAuth";

// GET: list all jobs (newest first), for the admin's own reference
export async function GET(req: NextRequest) {
  const authResult = await verifyAdminToken(req);
  if (authResult instanceof NextResponse) return authResult;

  await connectToDatabase();
  const jobs = await Job.find({}).sort({ createdAt: -1 }).limit(50);
  return NextResponse.json(jobs);
}

// POST: create a new job, unassigned (technicianUid: null) so it enters
// the shared pool for any approved technician in that category.
export async function POST(req: NextRequest) {
  const authResult = await verifyAdminToken(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const { category, clientName, clientPhone, address, scheduledFor, price, description } = body;

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
    return NextResponse.json(job, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
