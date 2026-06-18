import { NextResponse } from "next/server";

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_API_KEY =
  "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ0MDQyNzMyNiwiYWFpIjoxMSwidWlkIjo2MjE1MTQ3MSwiaWFkIjoiMjAyNC0xMS0yM1QxODo1NTo0Ny40NThaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjM5NDMwODYsInJnbiI6ImV1YzEifQ.t5IONmg4UE6uHeN7qmkBI1cEGE4YKcYkDgutGA6q_Ic"; // Укажите ваш API-ключ Monday.com
const NEWSLETTER_BOARD_ID = "1761993654"; // Укажите ID доски для рассылок

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, currentDate, currentPage } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    const query = `
      mutation {
        create_item (
          board_id: ${NEWSLETTER_BOARD_ID},
          item_name: "${email}",
          column_values: "${JSON.stringify({
            date4: currentDate,
            text_mkkwhb80: currentPage,
          }).replace(/"/g, '\\"')}"
        ) {
          id
        }
      }
    `;

    const response = await fetch(MONDAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: MONDAY_API_KEY,
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    if (data.errors) {
      console.error("Errors from Monday.com API:", data.errors);
      return NextResponse.json(
        { error: "Error while adding email to newsletter board." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Email successfully added to newsletter board." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
