const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateOtpHtml = (otp) => {
  return `
    <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
      <h2 style="color: #333;">Your OTP Code</h2>
      <p style="font-size: 18px; color: #555;">Use the following OTP to complete your authentication process:</p>
      <div style="display: inline-block; background-color: #f0f0f0; padding: 10px 20px; border-radius: 5px; margin-top: 20px;">
        <span style="font-size: 24px; font-weight: bold; color: #007BFF;">${otp}</span>
      </div>
      <p style="font-size: 14px; color: #999; margin-top: 30px;">This OTP is valid for 10 minutes.</p>
    </div>
  `;
};

export { generateOTP, generateOtpHtml };
