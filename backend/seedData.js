require('dotenv').config();
const mongoose = require('mongoose');
const CompletedWorkout = require('./models/CompletedWorkout');
const TargetMuscle = require('./models/TargetMuscle');

const data = {
  "2026-06-10": {
    "Chest": {
      "Incline Dumbbell Press": [
        "17.5kg/hand × 10",
        "20kg/hand × 5",
        "25kg/hand × 9",
        "30kg/hand × 10",
        "30kg/hand × 10"
      ],
      "Flat Dumbbell Press": [
        "30kg/hand × 10",
        "30kg/hand × 7",
        "25kg/hand × 10"
      ],
      "Incline Dumbbell Fly": [
        "12.5kg/hand × 15",
        "12.5kg/hand × 15",
        "12.5kg/hand × 15"
      ],
      "Pec Dec Fly": [
        "45kg × 15",
        "50kg × 12"
      ]
    },
    "Biceps": {
      "Hammer Curl": [
        "17.5kg/hand × 10",
        "20kg/hand × 8",
        "20kg/hand × 8"
      ],
      "Dumbbell Curl": [
        "15kg/hand × 9",
        "15kg/hand × 8",
        "15kg/hand × 8"
      ]
    }
  },
  "2026-06-11": {
    "Triceps": {
      "Tricep Pushdown": [
        "45kg × 15",
        "50kg × 14",
        "50kg × 14",
        "50kg × 10"
      ],
      "Overhead Cable Extension": [
        "35kg × 15",
        "40kg × 11",
        "40kg × 12"
      ],
      "Overhead Dumbbell Extension": [
        "17.5kg × 12",
        "17.5kg × 13",
        "17.5kg × 13"
      ]
    }
  }
};

const equipmentMap = {
  "Dumbbell Bicep Curl": "dumbbell",
  "Dumbbell Curl": "dumbbell",
  "Barbell Curl": "barbell",
  "Pec Dec Fly": "machine",
  "Single Arm Rear Delt Pec Dec": "machine",
  "Preacher Curl": "barbell",
  "Incline Dumbbell Press": "dumbbell",
  "Flat Dumbbell Press": "dumbbell",
  "Incline Dumbbell Fly": "dumbbell",
  "Dumbbell Press": "dumbbell",
  "Lateral Raise": "dumbbell",
  "Hammer Curl": "dumbbell",
  "Incline Dumbbell Curl": "dumbbell",
  "Tricep Pushdown": "cable",
  "Triceps Pushdown": "cable",
  "Overhead Extension": "cable",
  "Overhead Cable Extension": "cable",
  "Overhead Dumbbell Extension": "dumbbell",
  "Reverse Cable Curl": "cable",
  "Wrist Curl": "barbell",
  "Lat Pulldown": "cable",
  "T-Bar Row": "barbell",
  "Straight Arm Pulldown": "cable",
  "Single Arm Dumbbell Row": "dumbbell",
  "Cable Fly High To Low": "cable"
};

const parseSet = (setString) => {
  const parts = setString.split('×').map(s => s.trim());
  const weightPart = parts[0];
  const repsStr = parts[1];
  
  let finalWeight = 0;
  
  if (weightPart.includes('rod')) {
    const match = weightPart.match(/([0-9.]+)kg rod \+ ([0-9.]+)kg\/side/);
    if (match) {
      const rod = parseFloat(match[1]);
      const side = parseFloat(match[2]);
      finalWeight = rod + (side * 2);
    }
  } else {
    const weightStr = weightPart.replace(/kg\/hand/g, '').replace(/kg/g, '').trim();
    finalWeight = parseFloat(weightStr);
  }
  
  return {
    weight: finalWeight,
    reps: parseInt(repsStr, 10)
  };
};

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    for (const dateStr of Object.keys(data)) {
      const baseDate = new Date(`${dateStr}T12:00:00Z`);
      
      const startOfDay = new Date(`${dateStr}T00:00:00Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59Z`);
      await CompletedWorkout.deleteMany({
        startTime: { $gte: startOfDay, $lte: endOfDay }
      });
      await TargetMuscle.deleteMany({ dateString: dateStr });
      console.log(`\nCleared existing workouts and target muscles for ${dateStr}`);

      const categories = Object.keys(data[dateStr]);
      
      const targetMuscle = new TargetMuscle({
        userId: 'default_user',
        dateString: dateStr,
        muscles: categories
      });
      await targetMuscle.save();
      console.log(`Saved target muscles: ${categories.join(', ')} for ${dateStr}`);

      for (const category of categories) {
        const exercises = data[dateStr][category];

        for (const [exerciseName, setsStrings] of Object.entries(exercises)) {
          const equipmentType = equipmentMap[exerciseName] || 'barbell';
          
          const sets = setsStrings.map((str, index) => {
            const { weight, reps } = parseSet(str);
            return {
              id: `set_${Math.random().toString(36).substr(2, 9)}`,
              exerciseId: 'custom-exercise',
              weight,
              reps,
              completed: true,
              createdAt: baseDate,
              updatedAt: baseDate
            };
          });

          const totalSets = sets.length;
          const totalVolume = sets.reduce((acc, s) => acc + (s.weight * s.reps), 0);

          const workoutId = `wo_${Math.random().toString(36).substr(2, 9)}`;

          const completedWorkout = new CompletedWorkout({
            id: workoutId,
            userId: 'default_user',
            name: exerciseName,
            category: category,
            equipmentType: equipmentType,
            startTime: baseDate,
            endTime: new Date(baseDate.getTime() + 30 * 60000), // +30 mins
            totalVolume,
            totalSets,
            workoutData: {
              id: workoutId,
              name: exerciseName,
              category: category,
              equipmentType: equipmentType,
              startTime: baseDate,
              endTime: new Date(baseDate.getTime() + 30 * 60000),
              sets: sets,
              createdAt: baseDate,
              updatedAt: baseDate
            }
          });

          await completedWorkout.save();
          console.log(`Saved ${exerciseName} with ${totalSets} sets.`);
        }
      }
    }

    console.log('\nSeeding complete!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
