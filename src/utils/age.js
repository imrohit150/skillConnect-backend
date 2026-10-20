
const isAtLeast18 = (dateString) => {
  const birthDate = new Date(`${dateString}T00:00:00.000Z`);
  const today = new Date();

  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - birthDate.getUTCMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getUTCDate() < birthDate.getUTCDate())
  ) {
    age--;
  }

  return age >= 18;
};

module.exports = { isAtLeast18 };