const gql = require("graphql-tag");

const typeDefs = gql`
  type Student {
    id: ID!
    name: String!
    email: String!
    age: Int!
    major: String
    courses: [Course!]!
    coursesCount: Int!
  }

  type Course {
    id: ID!
    title: String!
    code: String!
    credits: Int!
    instructor: String!
    students: [Student!]!
    studentsCount: Int!
  }

  type User {
    id: ID!
    email: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input StudentUpdateInput {
    name: String
    email: String
    age: Int
    major: String
  }

  input CourseUpdateInput {
    title: String
    code: String
    credits: Int
    instructor: String
  }

  input ListOptions {
    limit: Int
    offset: Int
    sortBy: String
    sortOrder: String
  }

  input StudentFilter {
    major: String
    nameContains: String
    emailContains: String
    minAge: Int
    maxAge: Int
  }

  input CourseFilter {
    codePrefix: String
    titleContains: String
    instructor: String
    minCredits: Int
    maxCredits: Int
  }

  type Query {
    getAllStudents(filter: StudentFilter, options: ListOptions): [Student!]!
    getStudent(id: ID!): Student
    getAllCourses(filter: CourseFilter, options: ListOptions): [Course!]!
    getCourse(id: ID!): Course
    searchStudentsByMajor(major: String!): [Student!]!
  }

  type Mutation {
    addStudent(
      name: String!
      email: String!
      age: Int!
      major: String
    ): Student!
    updateStudent(id: ID!, input: StudentUpdateInput!): Student
    deleteStudent(id: ID!): Boolean!

    addCourse(
      title: String!
      code: String!
      credits: Int!
      instructor: String!
    ): Course!
    updateCourse(id: ID!, input: CourseUpdateInput!): Course
    deleteCourse(id: ID!): Boolean!

    signup(email: String!, password: String!): AuthPayload!

    login(email: String!, password: String!): AuthPayload!

    enrollStudent(studentId: ID!, courseId: ID!): Student!
    unenrollStudent(studentId: ID!, courseId: ID!): Student!
  }
`;

module.exports = typeDefs;
