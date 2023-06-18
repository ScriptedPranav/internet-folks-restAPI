import express from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { db } from "../utils/db.server";

const router = express.Router();

// Define the request body schema
const addMemberSchema = z.object({
  community: z.string(),
  user: z.string(),
  role: z.string(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    // Validate the request body
    const requestBody = addMemberSchema.parse(req.body);

    // Extract the parameters from the validated request body
    const { community, user, role } = requestBody;

    // Check if the user is the community admin
    const accessToken = req.headers.authorization?.split(" ")[1] || "";
    const userId = getUserIdFromAccessToken(accessToken);
    const isAdmin = await checkIfUserIsCommunityAdmin(userId, community);

    if (!isAdmin) {
      return res.status(403).json({
        status: false,
        errors: [
          {
            message: "You are not authorized to perform this action.",
            code: "NOT_ALLOWED_ACCESS",
          },
        ],
      });
    }

    // Check if the community exists
    const existingCommunity = await db.community.findUnique({
      where: { id: community },
    });

    if (!existingCommunity) {
      return res.status(404).json({
        status: false,
        errors: [
          {
            param: "community",
            message: "Community not found.",
            code: "RESOURCE_NOT_FOUND",
          },
        ],
      });
    }

    // Check if the role exists
    const existingRole = await db.role.findUnique({ where: { id: role } });

    if (!existingRole) {
      return res.status(404).json({
        status: false,
        errors: [
          {
            param: "role",
            message: "Role not found.",
            code: "RESOURCE_NOT_FOUND",
          },
        ],
      });
    }

    // Check if the user exists
    const existingUser = await db.user.findUnique({ where: { id: user } });

    if (!existingUser) {
      return res.status(404).json({
        status: false,
        errors: [
          {
            param: "user",
            message: "User not found.",
            code: "RESOURCE_NOT_FOUND",
          },
        ],
      });
    }

    // Check if the user is already a member of the community
    const existingMember = await db.member.findFirst({
      where: {
        community: community,
        user: user,
      },
    });

    if (existingMember) {
      return res.status(400).json({
        status: false,
        errors: [
          {
            message: "User is already added in the community.",
            code: "RESOURCE_EXISTS",
          },
        ],
      });
    }

    // Create the new member
    const newMember = await db.member.create({
      data: {
        community: community,
        user: user,
        role: role,
      },
      select: {
        id: true,
        community: true,
        user: true,
        role: true,
        created_at: true,
      },
    });

    // Return the success response
    return res.status(200).json({
      status: true,
      content: {
        data: newMember,
      },
    });
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: false,
        errors: error.errors.map((err) => ({
          message: err.message,
          code: "VALIDATION_ERROR",
          path: err.path.join("."),
        })),
      });
    }

    // Return a generic error response for any other errors
    return res.status(500).json({
      status: false,
      errors: [
        {
          message: "Internal Server Error",
          code: "INTERNAL_SERVER_ERROR",
        },
      ],
    });
  }
});

function getUserIdFromAccessToken(accessToken: string) {
  try {
    const decodedToken: any = jwt.verify(
      accessToken,
      process.env.JWT_SECRET as string
    );
    return decodedToken.id;
  } catch (error) {
    return null;
  }
}

async function checkIfUserIsCommunityAdmin(
  userId: string | null,
  communityId: string
): Promise<boolean> {
  if (!userId) {
    return false;
  }
  // Retrieve the community from the database
  const community = await db.community.findUnique({
    where: { id: communityId },
  });

  // Check if the community exists and if the user is the admin
  if (community && community.owner === userId) {
    return true;
  }

  return false;
}

router.delete("/:id", async (req: Request, res: Response) => {
    try {
      // Get the member ID from the request parameters
      const memberId = req.params.id;
  
      // Check if the member exists in the database
      const existingMember = await db.member.findUnique({
        where: { id: memberId },
      });
  
      if (!existingMember) {
        return res.status(404).json({
          status: false,
          errors: [
            { message: "Member not found.", code: "RESOURCE_NOT_FOUND" },
          ],
        });
      }
  
      // Get the access token from the authorization header
      const accessToken = req.headers.authorization?.split(" ")[1] || "";
  
      // Check if the user is a community admin or moderator
      const isAdminOrModerator = checkIfUserIsCommunityAdminOrModerator(accessToken);
  
      if (!isAdminOrModerator) {
        return res.status(403).json({
          status: false,
          errors: [
            {
              message: "You are not authorized to perform this action.",
              code: "NOT_ALLOWED_ACCESS",
            },
          ],
        });
      }
  
      // Remove the member from the database
      await db.member.delete({ where: { id: memberId } });
  
      // Return the success response
      return res.status(200).json({
        status: true,
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

  async function checkIfUserIsCommunityAdminOrModerator(accessToken: string) {
    // Get the user ID from the access token
    const userId = getUserIdFromAccessToken(accessToken);
  
    // Retrieve the user's roles from the database
    const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          member: {
            include: {
              community_fk: {
                select: { id: true },
              },
              role_fk: {
                select: { name: true },
              },
            },
          },
        },
      });
  
    // Check if the user has the "community_admin" or "community_moderator" role
    const isAdminOrModerator = user?.member.some(
      (member) =>
        member.role_fk.name === "Community Admin" || member.role_fk.name === "Community Moderator"
    );
  
    return isAdminOrModerator;
  }
  
export default router;
