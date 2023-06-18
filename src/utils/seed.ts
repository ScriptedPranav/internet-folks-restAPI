import { db } from "./db.server";
import { Snowflake } from "@theinternetfolks/snowflake";
import { faker } from '@faker-js/faker';
import {User,Community,Role,Member} from '../../types.d';


async function seedData() {
  // Seed Users
  const users: User[] = [];
  for (let i = 0; i < 10; i++) {
    const user: User = {
      id: Snowflake.generate(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      created_at: new Date(),
    };
    users.push(user);
  }
  await Promise.all(users.map((user) => db.user.create({ data: user })));

  // Seed Communities
  const communities: Community[] = [];
  for (let i = 0; i < 5; i++) {
    const community: Community = {
      id: Snowflake.generate(),
      name: faker.company.name(),
      slug: faker.lorem.slug(),
      owner: users[i].id,
      created_at: new Date(),
      updated_at: new Date(),
    };
    communities.push(community);
  }
  await Promise.all(communities.map((community) => db.community.create({ data: community })));

  // Seed Roles
  const roles: Role[] = [];
  for (let i = 0; i < 3; i++) {
    const role: Role = {
      id: Snowflake.generate(),
      name: faker.person.jobTitle(),
      created_at: new Date(),
      updated_at: new Date(),
    };
    roles.push(role);
  }
  await Promise.all(roles.map((role) => db.role.create({ data: role })));

  // Seed Members
  const members: Member[] = [];
  for (const community of communities) {
    for (let i = 0; i < 3; i++) {
      const member: Member = {
        id: Snowflake.generate(),
        community: community.id,
        user: users[i].id,
        role: roles[i].id,
        created_at: new Date(),
      };
      members.push(member);
    }
  }
  await Promise.all(members.map((member) => db.member.create({ data: member })));

  console.log("Seed data completed successfully.");
}

seedData()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

