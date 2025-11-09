const Student = require("../models/Student");
const Course = require("../models/Course");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const { generateToken, guardResolver } = require("../utils/auth");

// Helpers: small utilities to keep resolvers concise
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Normalize and validate email
const normalizeEmail = (email) => email?.toLowerCase();
const isValidEmail = (email) => EMAIL_REGEX.test(email);

// Validate course credits (1..6)
const isValidCredits = (credits) => credits >= 1 && credits <= 6;

// Build case-insensitive exact-match regex
const eqRegex = (value) => new RegExp("^" + value + "$", "i");
// Build case-insensitive contains regex
const containsRegex = (value) => new RegExp(value, "i");

// Apply paging and sorting consistently
function applyListOptions(query, options, { defaultLimit = 10, maxLimit = 50 } = {}) {
  if (options?.sortBy) {
    const sortOrder = options.sortOrder === "DESC" ? -1 : 1;
    query = query.sort({ [options.sortBy]: sortOrder });
  }
  const limit = Math.min(options?.limit || defaultLimit, maxLimit);
  const offset = options?.offset || 0;
  return query.skip(offset).limit(limit);
}

// Check if an array field appears populated by inspecting a known key on first item
const isFieldPopulated = (arr, key) => Array.isArray(arr) && arr.length > 0 && arr[0] && arr[0][key];

const resolvers = {
  Student: {
    courses: async (parent) => {
      if (isFieldPopulated(parent.courses, "title")) {
        return parent.courses;
      }
      const student = await Student.findById(parent._id).populate("courses");
      return student.courses || [];
    },

    coursesCount: async (parent) => {
      if (isFieldPopulated(parent.courses, "title")) {
        return parent.courses.length;
      }

      const student = await Student.findById(parent._id);
      return student.courses?.length || 0;
    },
  },

  Course: {
    students: async (parent) => {
      if (isFieldPopulated(parent.students, "name")) {
        return parent.students;
      }
      const course = await Course.findById(parent._id).populate("students");
      return course.students || [];
    },

    studentsCount: async (parent) => {
      if (isFieldPopulated(parent.students, "name")) {
        return parent.students.length;
      }
      const course = await Course.findById(parent._id);
      return course.students?.length || 0;
    },
  },

  Query: {
    getAllStudents: guardResolver(async (_, { filter, options }) => {
      const query = {};

      if (filter) {
        if (filter.major) query.major = eqRegex(filter.major);
        if (filter.nameContains) query.name = containsRegex(filter.nameContains);
        if (filter.emailContains) query.email = containsRegex(filter.emailContains);
        if (filter.minAge !== undefined || filter.maxAge !== undefined) {
          query.age = {};
          if (filter.minAge !== undefined) query.age.$gte = filter.minAge;
          if (filter.maxAge !== undefined) query.age.$lte = filter.maxAge;
        }
      }

      const studentsQuery = applyListOptions(Student.find(query), options);
      return studentsQuery.populate("courses");
    }),

    getStudent: guardResolver(
      async (_, { id }) => await Student.findById(id).populate("courses")
    ),

    getAllCourses: guardResolver(async (_, { filter, options }) => {
      const query = {};

      if (filter) {
        if (filter.codePrefix) query.code = new RegExp("^" + filter.codePrefix, "i");
        if (filter.titleContains) query.title = containsRegex(filter.titleContains);
        if (filter.instructor) query.instructor = eqRegex(filter.instructor);
        if (filter.minCredits !== undefined || filter.maxCredits !== undefined) {
          query.credits = {};
          if (filter.minCredits !== undefined) query.credits.$gte = filter.minCredits;
          if (filter.maxCredits !== undefined) query.credits.$lte = filter.maxCredits;
        }
      }

      const coursesQuery = applyListOptions(Course.find(query), options);
      return coursesQuery.populate("students");
    }),

    getCourse: guardResolver(
      async (_, { id }) => await Course.findById(id).populate("students")
    ),

    searchStudentsByMajor: guardResolver(
      async (_, { major }) =>
        await Student.find({ major: eqRegex(major) }).populate("courses")
    ),
  },

  Mutation: {
    addStudent: guardResolver(async (_, { name, email, age, major }) => {
      if (!isValidEmail(email)) {
        throw new Error("Invalid email format");
      }

      if (age < 16) {
        throw new Error("Age must be at least 16");
      }

      const existingStudent = await Student.findOne({ email: normalizeEmail(email) });
      if (existingStudent) {
        throw new Error("Email already in use");
      }

      const student = await Student.create({
        name,
        email: normalizeEmail(email),
        age,
        major,
      });
      return await student.populate("courses");
    }),

    updateStudent: guardResolver(async (_, { id, input }) => {
      if (input.email) {
        if (!isValidEmail(input.email)) {
          throw new Error("Invalid email format");
        }

        const existingStudent = await Student.findOne({
          email: normalizeEmail(input.email),
          _id: { $ne: id },
        });
        if (existingStudent) {
          throw new Error("Email already in use");
        }

        input.email = normalizeEmail(input.email);
      }

      if (input.age !== undefined && input.age < 16) {
        throw new Error("Age must be at least 16");
      }

      const student = await Student.findByIdAndUpdate(id, input, {
        new: true,
        runValidators: true,
      }).populate("courses");

      if (!student) {
        throw new Error("Student not found");
      }

      return student;
    }),

    deleteStudent: guardResolver(async (_, { id }) => {
      const student = await Student.findByIdAndDelete(id);
      if (!student) return false;
      await Course.updateMany(
        { students: student._id },
        { $pull: { students: student._id } }
      );
      return true;
    }),

    addCourse: guardResolver(
      async (_, { title, code, credits, instructor }) => {
        if (!isValidCredits(credits)) {
          throw new Error("Credits must be between 1 and 6");
        }

        const existingCourse = await Course.findOne({
          code: code.toUpperCase(),
        });
        if (existingCourse) {
          throw new Error("Course code already exists");
        }

        const course = await Course.create({
          title,
          code: code.toUpperCase(),
          credits,
          instructor,
        });
        return await course.populate("students");
      }
    ),

    updateCourse: guardResolver(async (_, { id, input }) => {
      if (input.credits !== undefined) {
        if (!isValidCredits(input.credits)) {
          throw new Error("Credits must be between 1 and 6");
        }
      }

      if (input.code) {
        const existingCourse = await Course.findOne({
          code: input.code.toUpperCase(),
          _id: { $ne: id },
        });
        if (existingCourse) {
          throw new Error("Course code already exists");
        }

        input.code = input.code.toUpperCase();
      }

      const course = await Course.findByIdAndUpdate(id, input, {
        new: true,
        runValidators: true,
      }).populate("students");

      if (!course) {
        throw new Error("Course not found");
      }

      return course;
    }),

    deleteCourse: guardResolver(async (_, { id }) => {
      const course = await Course.findByIdAndDelete(id);

      if (!course) return false;
      await Student.updateMany(
        { courses: course._id },
        { $pull: { courses: course._id } }
      );
      return true;
    }),

    signup: async (_, { email, password }) => {
      email = normalizeEmail(email);
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ email, password: hashedPassword });
      const token = generateToken(user);
      return { user, token };
    },

    login: async (_, { email, password }) => {
      email = normalizeEmail(email);
      const user = await User.findOne({ email });
      if (!user) throw new Error("Invalid credentials");
      const isMatched = await bcrypt.compare(password, user.password);
      if (!isMatched) throw new Error("Invalid credentials");
      const token = generateToken(user);
      return { user, token };
    },

    enrollStudent: guardResolver(async (_, { studentId, courseId }) => {
      const student = await Student.findById(studentId);
      if (!student) {
        throw new Error("Student not found");
      }

      const course = await Course.findById(courseId);
      if (!course) {
        throw new Error("Course not found");
      }

      const alreadyEnrolled = student.courses.some(
        (id) => id.toString() === courseId
      );

      if (alreadyEnrolled) {
        return await student.populate("courses");
      }

      student.courses.push(courseId);
      await student.save();

      course.students.push(studentId);
      await course.save();

      return await student.populate("courses");
    }),

    unenrollStudent: guardResolver(async (_, { studentId, courseId }) => {
      const student = await Student.findById(studentId);
      if (!student) {
        throw new Error("Student not found");
      }

      const course = await Course.findById(courseId);
      if (!course) {
        throw new Error("Course not found");
      }

      student.courses = student.courses.filter(
        (id) => id.toString() !== courseId
      );
      await student.save();

      course.students = course.students.filter(
        (id) => id.toString() !== studentId
      );
      await course.save();

      return await student.populate("courses");
    }),
  },
};

module.exports = resolvers;
