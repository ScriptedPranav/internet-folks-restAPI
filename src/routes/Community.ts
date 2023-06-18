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

// GET /v1/community/:id/members
router.get("/:id/members", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Retrieve the page number from the query parameters or default to 1
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = 10;
    const skip = (page - 1) * pageSize;

    // Get the total count of members in the community
    const totalMembers = await db.member.count({
      where: { community: id },
    });

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalMembers / pageSize);

    // Fetch the members of the community with pagination
    const members = await db.member.findMany({
      where: { community: id },
      select: {
        id: true,
        community: true,
        user_fk: {
          select: {
            id: true,
            name: true,
          },
        },
        role: true,
        created_at: true,
      },
      skip,
      take: pageSize,
    });

    // Extract the unique role IDs from the members
    const roleIds = Array.from(new Set(members.map((member) => member.role)));

    // Fetch the roles using the extracted role IDs
    const roles = await db.role.findMany({
      where: { id: { in: roleIds } },
      select: {
        id: true,
        name: true,
      },
    });

    // Combine the member and role data to create the desired response structure
    const responseData = members.map((member) => ({
      id: member.id,
      community: member.community,
      user: member.user_fk,
      role: roles.find((role) => role.id === member.role),
      created_at: member.created_at,
    }));

    // Return the success response
    return res.status(200).json({
      status: true,
      content: {
        meta: {
          total: totalMembers,
          pages: totalPages,
          page: page,
        },
        data: responseData,
      },
    });
  } catch (error) {
    // Return a generic error response for any errors
    return res.status(500).json({
      status: false,
      errors: [
        { message: "Internal Server Error", code: "INTERNAL_SERVER_ERROR" },
      ],
    });
  }
});

// GET /v1/community/me/owner
router.get("/me/owner", async (req: Request, res: Response) => {
  try {
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

    // Get the communities owned by the user
    const communities = await db.community.findMany({
      where: {
        owner: ownerId,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        owner: true,
        created_at: true,
        updated_at: true,
      },
    });

    // Return the success response
    return res.status(200).json({
      status: true,
      content: {
        meta: {
          total: communities.length,
          pages: 1,
          page: 1,
        },
        data: communities,
      },
    });
  } catch (error) {
    // Return a generic error response for any errors
    return res.status(500).json({
      status: false,
      errors: [
        { message: "Internal Server Error", code: "INTERNAL_SERVER_ERROR" },
      ],
    });
  }
});

router.get("/me/member", async (req: Request, res: Response) => {
  try {
    // Get the user ID from the access token
    const accessToken = req.headers.authorization?.split(" ")[1] || "";
    const userId = getUserIdFromAccessToken(accessToken);

    if (!userId) {
      return res.status(401).json({
        status: false,
        errors: [
          { message: "You need to sign in to proceed.", code: "NOT_SIGNEDIN" },
        ],
      });
    }

    // Get the communities where the user is the owner or a member
    const communities = await db.community.findMany({
      where: {
        OR: [{ owner: userId }, { members: { some: { user: userId } } }],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerId: {
          select: {
            id: true,
            name: true,
          },
        },
        created_at: true,
        updated_at: true,
      },
    });

    // Prepare the response object
    const response = {
      status: true,
      content: {
        meta: {
          total: communities.length,
          pages: 1,
          page: 1,
        },
        data: communities,
      },
    };

    // Return the success response
    return res.status(200).json(response);
  } catch (error) {
    // Return a generic error response for any errors
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
