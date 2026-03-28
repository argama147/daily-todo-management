import { NextResponse } from "next/server";
import { auth } from "auth";
import { google } from "googleapis";

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  try {
    const listsResponse = await tasksApi.tasklists.list({ maxResults: 100 });
    const lists = (listsResponse.data.items || []).map(list => ({
      id: list.id!,
      title: list.title || "(無題のリスト)"
    }));

    return NextResponse.json({ lists });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Google Tasks API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch task lists", detail: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}