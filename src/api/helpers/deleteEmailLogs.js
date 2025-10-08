import EmailLog from "../../models/emailLogs/index.js"

const DeleteEmailLogs = async () =>{
    try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const result = await EmailLog.deleteMany({
      createdAt: { $lt: fourteenDaysAgo }
    });

    console.log(`${result.deletedCount} logs older than 14 days deleted.`);
    } catch (error) {
      console.error(error.message);
    }
}

export default DeleteEmailLogs;