const { createUserAndSendVerification, verifyEmailToken, resendVerification, login, requestPasswordReset, resetPassword } =
  require("../services/auth.service");
const { User } = require("../models");
const { loginWithGoogle } = require("../services/auth.service");


async function register(req, res, next) {
  try {
    const user = await createUserAndSendVerification(req.body);
    res.status(201).json({
      message: "Registered. Check your email to verify your account.",
      user: { id: user.id, email: user.email },
    });
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    await verifyEmailToken(req.params.token);
    res.json({ message: "Email verified. You can now log in." });
  } catch (err) { next(err); }
}

async function resend(req, res, next) {
  try {
    await resendVerification(req.body.email);
    res.json({ message: "Verification email sent." });
  } catch (err) { next(err); }
}

async function signIn(req, res, next) {
  try {
    const { user, token } = await login(req.body);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, accountType: user.accountType },
    });
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    const user = await User.findByPk(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user.id, name: user.name, email: user.email, accountType: user.accountType });
  } catch (err) { next(err); }
}


async function googleSignIn(req, res, next) {
  try {
    const { idToken, accountType,accessToken } = req.body;
    const { user, token } = await loginWithGoogle({ idToken, accountType,accessToken });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
      },
    });
  } catch (err) {
    next(err);
  }
}


async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    await requestPasswordReset(email);
    // Always respond success to avoid user enumeration
    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
}

async function confirmResetPassword(req, res, next) {
  try {
    const {  token, password } = req.body;
    await resetPassword({ token, password });
    res.json({ message: "Password has been reset successfully. You can now log in." });
  } catch (err) {
    next(err);
  }
}


module.exports = { forgotPassword,
confirmResetPassword,register, verify, resend, signIn, me , googleSignIn};
