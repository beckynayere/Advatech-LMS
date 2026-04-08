import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function testLogin() {
  const email = 'admin@tuk.ac.ke';
  const password = 'ChangeMe@2025!';
  
  // Find user
  const user = await prisma.users.findFirst({
    where: { email: email },
    include: {
      user_roles: {
        include: {
          roles: true
        }
      }
    }
  });
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  console.log('User found:', user.email);
  console.log('Password hash:', user.password_hash);
  
  // Verify password
  const validPassword = await bcrypt.compare(password, user.password_hash);
  console.log('Password valid:', validPassword);
  
  if (validPassword) {
    // Generate token
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.user_roles.map(ur => ur.roles.name),
      institutionId: user.institution_id
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '24h'
    });
    
    console.log('\n✅ Token generated successfully!');
    console.log('Token:', token);
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    console.log('\nDecoded token:', decoded);
  }
}

testLogin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
