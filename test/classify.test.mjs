// Offline tests for the email classifier (English and French). Run: npm test
import assert from "node:assert/strict";
import { classifyEmail } from "../supabase/functions/_shared/classify.js";

const cases = [
  ["EN confirmation with 'schedule an interview if selected' boilerplate", "confirmation", {
    subject: "Thank you for applying to Bombardier",
    body: "Hi Shivangi, thank you for applying to the Intern, Quality Analyst (Winter 2027) position. We have received your application. If your qualifications match our needs, a recruiter will contact you to schedule an interview. Unfortunately, we are unable to respond to every applicant individually." }],
  ["EN confirmation, 'if you are not selected' boilerplate", "confirmation", {
    subject: "Application received",
    body: "We received your application for Operations Intern. If you are not selected for this position, we will keep your resume on file." }],
  ["LinkedIn 'application was sent'", "confirmation", {
    subject: "Shivangi, your application was sent to Moderna", body: "Your application was sent to Moderna. Co-Op, Supply Chain Planning.", fromEmail: "jobs-noreply@linkedin.com" }],
  ["FR confirmation with conditional interview", "confirmation", {
    subject: "Merci d'avoir postulé",
    body: "Merci d'avoir postulé chez Pratt & Whitney. Nous avons bien reçu votre candidature. Si votre profil correspond, nous communiquerons avec vous pour planifier une entrevue." }],
  ["EN interview invitation", "interview", {
    subject: "Next steps - Supply Chain Intern",
    body: "We would like to invite you to a video interview for the Supply Chain Intern role. Please select a time that works for you using the link below." }],
  ["FR interview invitation", "interview", {
    subject: "Entrevue - Stagiaire qualité",
    body: "Bonjour, nous aimerions vous rencontrer pour une entrevue. Veuillez nous indiquer vos disponibilités." }],
  ["online assessment counts as interview stage", "interview", {
    subject: "Your assessment", body: "Please complete the online assessment within 5 days using this link." }],
  ["EN rejection after thanks-for-interest", "rejection", {
    subject: "Update on your application",
    body: "Thank you for your interest in CAE. Unfortunately, we have decided to pursue other candidates for this role." }],
  ["EN rejection after an interview", "rejection", {
    subject: "Your application", body: "Thank you for taking the time to interview with us. After careful consideration, we have decided to move forward with other candidates." }],
  ["FR rejection", "rejection", {
    subject: "Suivi de votre candidature",
    body: "Nous vous remercions de l'intérêt porté à notre entreprise. Malheureusement, votre candidature n'a pas été retenue." }],
  ["offer", "offer", {
    subject: "Congratulations", body: "We are pleased to extend an offer of employment for the Industrial Engineering Intern position." }],
  ["job alert newsletter is ignored", "other", { subject: "5 new jobs for you: Supply Chain Intern", body: "Jobs you may be interested in. Apply now." }],
  ["unrelated email is ignored", "other", { subject: "Your weekly newsletter", body: "Here is what happened this week." }],
];
for (const [name, want, email] of cases) {
  const got = classifyEmail(email);
  assert.equal(got.kind, want, `${name}: expected ${want}, got ${got.kind} (${got.reasons.join(" | ")})`);
}

// Gmail forwarding handshake: the code is surfaced so the user can finish setup.
const v = classifyEmail({ fromEmail: "forwarding-noreply@google.com", subject: "Gmail Forwarding Confirmation - Receive Mail from user@gmail.com",
  body: "user@gmail.com has requested to automatically forward mail to your email address. Confirmation code: 123456789\nTo allow, click the link." });
assert.equal(v.kind, "verification");
assert.equal(v.code, "123456789");

// confidence is reported, never overstated
assert.equal(classifyEmail({ subject: "Unfortunately", body: "Unfortunately, we will not be moving forward with your application." }).confidence, "high");
assert.equal(classifyEmail({ subject: "x", body: "nothing relevant here" }).confidence, "low");
console.log(`classify: ${cases.length + 3} checks passed`);
