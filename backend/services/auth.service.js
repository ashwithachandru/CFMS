const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RepositoryFactory = require('../repositories/repository.factory');
const mailer = require('../config/mailer');
const { AuthError, ValidationError, NotFoundError, AppError } = require('../utils/errors');

const userRepo = RepositoryFactory.getUserRepository();
const roleRepo = RepositoryFactory.getRoleRepository();
const auditRepo = RepositoryFactory.getAuditRepository();

// Password complexity validator (returns an error string or null if valid)
function validatePasswordComplexity(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit (0-9).';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/[!@#$%^&*()\-_+=\[\]{};:'"<>,.?/\\|`~]/.test(password)) {
    return 'Password must contain at least one special character (e.g. !@#$%^&*).';
  }
  return null;
}

class AuthService {
  generateAccessToken(user) {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role || user.role_name, 
        warehouseId: user.warehouse_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  generateRefreshToken(user) {
    return jwt.sign(
      { userId: user.id },
      process.env.REFRESH_SECRET,
      { expiresIn: '7d' }
    );
  }

  async login(email, password, ipAddress, userAgent) {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new AuthError('Invalid email or password');
    }

    if (user.status !== 'Active') {
      throw new AuthError('Your account has been suspended');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AuthError('Invalid email or password');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Save refresh token to user record
    await userRepo.updateRefreshToken(user.id, refreshToken);

    // Log audit log
    await auditRepo.create({
      userId: user.id,
      action: 'LOGIN',
      ipAddress,
      userAgent,
      details: 'User logged in successfully'
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role || user.role_name,
        warehouseId: user.warehouse_id,
        warehouseName: user.warehouse_name
      }
    };
  }

  async register(userData, ipAddress, userAgent) {
    const existingUser = await userRepo.findByEmail(userData.email);
    if (existingUser) {
      throw new ValidationError('Email already registered');
    }

    const validRoles = ['Sales Executive', 'Warehouse Team', 'Warehouse Manager', 'Administrator'];
    const role = userData.role || userData.roleId || 'Sales Executive';
    if (!validRoles.includes(role)) {
      throw new ValidationError('Invalid role selected');
    }

    const passwordHash = await bcrypt.hash(userData.password, 10);
    const username = userData.username || userData.email.split('@')[0] + Math.floor(Math.random() * 1000);

    const userId = await userRepo.create({
      username,
      email: userData.email,
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role,
      warehouseId: userData.warehouseId || null,
      status: 'Active'
    });

    await auditRepo.create({
      userId,
      action: 'REGISTER',
      ipAddress,
      userAgent,
      details: `User registered with role: ${role}`
    });

    const user = await userRepo.findById(userId);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      warehouseName: user.warehouse_name
    };
  }

  async logout(userId, ipAddress, userAgent) {
    await userRepo.updateRefreshToken(userId, null);
    await auditRepo.create({
      userId,
      action: 'LOGOUT',
      ipAddress,
      userAgent,
      details: 'User logged out'
    });
  }

  async refreshToken(token, ipAddress, userAgent) {
    try {
      const decoded = jwt.verify(token, process.env.REFRESH_SECRET);
      const user = await userRepo.findById(decoded.userId);
      
      if (!user) {
        throw new AuthError('User not found');
      }

      // Fetch the full record to verify the refresh token still matches
      const fullUser = await userRepo.findByEmail(user.email);
      if (!fullUser || fullUser.refresh_token !== token) {
        throw new AuthError('Invalid refresh token');
      }

      if (user.status !== 'Active') {
        throw new AuthError('Your account has been suspended');
      }

      const accessToken = this.generateAccessToken(fullUser);
      return { accessToken };
    } catch (err) {
      if (err instanceof jwt.JsonWebTokenError) {
        throw new AuthError('Invalid or expired refresh token');
      }
      throw err;
    }
  }

  async forgotPassword(email, ipAddress, userAgent) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = await userRepo.findByEmail(cleanEmail);

    // Security: Do not reveal whether the email exists
    if (!user) {
      console.log(`Forgot password OTP requested for non-existent email: ${cleanEmail}`);
      return { message: 'If that email is registered, an OTP has been sent.' };
    }

    // Generate a 6-digit numeric OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Attempt real email delivery
    try {
      await mailer.sendOtpMail(user.email, otp);
    } catch (err) {
      console.error(`[SMTP ERROR] Could not deliver OTP email to ${cleanEmail}:`, err.message);
      throw new AppError("Unable to send verification email. Please try again later.", 503);
    }

    // Persist OTP in DB only upon successful delivery
    await userRepo.setOtp(user.email, otp, otpExpiry);

    await auditRepo.create({
      userId: user.id,
      action: 'PASSWORD_RESET_OTP_SENT',
      ipAddress,
      userAgent,
      details: 'Password reset OTP sent via mailer'
    });

    return { message: 'If that email is registered, an OTP has been sent.' };
  }

  async verifyOtp(email, otp, ipAddress, userAgent) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    const user = await userRepo.findByEmail(cleanEmail);
    if (!user) {
      throw new ValidationError('Invalid email or OTP.');
    }

    // Check OTP matches and hasn't expired
    if (!user.reset_token || user.reset_token !== cleanOtp) {
      throw new ValidationError('Incorrect OTP. Please try again.');
    }

    if (!user.reset_token_expiry || new Date(user.reset_token_expiry) < new Date()) {
      throw new ValidationError('OTP has expired. Please request a new one.');
    }

    // OTP verified — replace with a short-lived session token (30 min) so the
    // reset-password step can be authenticated without re-verifying OTP.
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await userRepo.setOtp(user.email, sessionToken, sessionExpiry);

    await auditRepo.create({
      userId: user.id,
      action: 'PASSWORD_RESET_OTP_VERIFIED',
      ipAddress,
      userAgent,
      details: 'OTP verified, session token issued'
    });

    return { resetToken: sessionToken };
  }

  async resetPassword(token, newPassword, ipAddress, userAgent) {
    // Validate password complexity server-side
    const complexityError = validatePasswordComplexity(newPassword);
    if (complexityError) {
      throw new ValidationError(complexityError);
    }

    // Works for both OTP-flow session tokens and legacy link-based tokens
    const user = await userRepo.findByOtp(token);
    if (!user) {
      throw new ValidationError('Invalid or expired reset token.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRepo.updatePassword(user.id, passwordHash);

    await auditRepo.create({
      userId: user.id,
      action: 'PASSWORD_RESET',
      ipAddress,
      userAgent,
      details: 'Password reset completed via OTP flow'
    });
  }

  async changePassword(userId, currentPassword, newPassword, ipAddress, userAgent) {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const fullUser = await userRepo.findByEmail(user.email);
    const isMatch = await bcrypt.compare(currentPassword, fullUser.password_hash);
    if (!isMatch) {
      throw new ValidationError('Incorrect current password');
    }

    // Validate new password complexity server-side
    const complexityError = validatePasswordComplexity(newPassword);
    if (complexityError) {
      throw new ValidationError(complexityError);
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await userRepo.updatePassword(userId, newPasswordHash);

    await auditRepo.create({
      userId,
      action: 'PASSWORD_CHANGE',
      ipAddress,
      userAgent,
      details: 'Password changed by authenticated user'
    });
  }

  async updateTheme(userId, theme, ipAddress, userAgent) {
    if (theme !== 'light' && theme !== 'dark') {
      throw new ValidationError('Invalid theme preference');
    }
    await userRepo.updateThemePreference(userId, theme);

    await auditRepo.create({
      userId,
      action: 'THEME_PREFERENCE_UPDATE',
      ipAddress,
      userAgent,
      details: `Theme preference updated to: ${theme}`
    });
  }
}

module.exports = AuthService;
