import bcrypt from 'bcrypt';
const hash = await bcrypt.hash('ChangeMe@2025!', 10);
console.log(hash);
