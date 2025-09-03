const Svc = require("../services/onboarding.service");

async function state(req, res, next) {
  try {

    console.log(req.user.sub)
    const out = await Svc.getState(req.user.sub);
    res.json(out);
  } catch (e) { next(e); }
}

async function saveProfileType(req, res, next) {
  console.log({aaaaaaaaa:req.user.sub,bbb:req.body.primaryIdentity})
  try {
    const out = await Svc.setProfileType(req.user.sub, req.body.primaryIdentity);
    res.json(out);
  } catch (e) { next(e); }
}

async function saveCategories(req, res, next) {
  try {
    const out = await Svc.setCategories(req.user.sub, req.body.categoryIds, req.body.subcategoryIds);
    res.json(out);
  } catch (e) { next(e); }
}

async function saveGoals(req, res, next) {
  console.log({x:req.user.sub})
  try {
    const out = await Svc.setGoals(req.user.sub, req.body.goalIds);
    res.json(out);
  } catch (e) { next(e); }
}

module.exports = { state, saveProfileType, saveCategories, saveGoals };
