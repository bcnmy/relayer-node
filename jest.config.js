module.exports = {
  preset: 'ts-jest',
  testTimeout: 600000,
  transform: {
    '^.+\\.(ts|tsx)?$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
};
