import { Router, Request, Response } from "express";
import { z } from "zod";
import { Snowflake } from "@theinternetfolks/snowflake";
import { db } from "../utils/db.server";
import jwt from "jsonwebtoken";

const router = Router();

// Define the request body schema
const communitySchema = z.object({
  name: z.string().min(2),
});

// POST /v1/community
router.post("/", async (req: Request, res: Response) => {
  try {
    // Validate the request body against the schema
    const validatedData = communitySchema.parse(req.body);

    // Generate the slug
    const slug = generateSlug(validatedData.name);

    // Get the owner ID from the access token
    const accessToken = req.headers.authorization?.split(" ")[1] || "";
    const ownerId = getUserIdFromAccessToken(accessToken);

    if (!ownerId) {
      return res.status(401).json({
        status: false,
        errors: [
          { message: "You need to sign in to proceed.", code: "NOT_SIGNEDIN" },
        ],
      });
    }

    // Generate a unique ID for the community using Snowflake
    const communityId = Snowflake.generate();

    // Create the community in the database
    const community = await db.community.create({
      data: {
        id: communityId,
        name: validatedData.name,
        slug,
        owner: ownerId,
      },
    });

    // Return the success response
    return res.status(201).json({
      status: true,
      content: {
        data: community,
      },
    });
  } catch (error) {
    // Handle the validation error and return the error response
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => ({
        param: err.path[0],
        message: err.message,
        code: "INVALID_INPUT",
      }));

      return res.status(400).json({
        status: false,
        errors,
      });
    }

    // Return a generic error response for any other errors
    return res.status(500).json({
      status: false,
      errors: [
        { message: "Internal Server Error", code: "INTERNAL_SERVER_ERROR" },
      ],
    });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    // Get total count of communities
    const totalCount = await db.community.count();

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / perPage);

    // Get communities with pagination
    const communities = await db.community.findMany({
      take: perPage,
      skip: skip,
      select: {
        id: true,
        name: true,
        slug: true,
        created_at: true,
        updated_at: true,
        ownerId: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Prepare the response object
    const response = {
      status: true,
      content: {
        meta: {
          total: totalCount,
          pages: totalPages,
          page: page,
        },
        data: communities,
      },
    };

    // Return the success response
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching communities:", error);
    return res.status(500).json({
      status: false,
      errors: [
        { message: "Internal Server Error", code: "INTERNAL_SERVER_ERROR" },
      ],
    });
  }
});

// Function to generate a slug from the name
function generateSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

// Function to extract user ID from the access token
function getUserIdFromAccessToken(accessToken: string): string | null {
  try {
    const decodedToken: any = jwt.verify(
      accessToken,
      process.env.JWT_SECRET as string
    );
    return decodedToken.id;
  } catch (error) {
    console.error("Error decoding access token:", error);
    return null;
  }
}

export default router;
